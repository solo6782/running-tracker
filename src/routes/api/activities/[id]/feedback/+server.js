import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function POST({ params, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	// 1. Get activity with laps
	const { data: activity } = await supabase
		.from('rt_activities')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!activity) return json({ error: 'Activité introuvable' }, { status: 404 });

	// 2. Find planned workout for this date
	const actDate = activity.activity_date.split('T')[0];
	const { data: programmes } = await supabase
		.from('rt_programmes')
		.select('race_name, race_date, race_distance, availability')
		.eq('active', true);

	let plannedWorkout = null;
	let raceName = null;
	for (const prog of (programmes || [])) {
		const avail = prog.availability || {};
		if (avail[actDate]?.plan) {
			plannedWorkout = avail[actDate].plan;
			raceName = prog.race_name;
			break;
		}
	}

	// 3. Get athlete profile
	const { data: profile } = await supabase
		.from('rt_profile')
		.select('*')
		.limit(1)
		.single();

	// 4. Format laps for prompt
	const lapsText = activity.laps ? activity.laps.map((l, i) => {
		const pace = l.average_speed > 0 ? (1000 / l.average_speed / 60).toFixed(2) : '?';
		const paceMin = Math.floor(pace);
		const paceSec = Math.round((pace - paceMin) * 60);
		return `  Lap ${i + 1} (${l.name}): ${(l.distance / 1000).toFixed(2)}km, ${Math.round(l.moving_time / 60)}min, allure ${paceMin}:${String(paceSec).padStart(2, '0')}/km, FC moy ${l.average_heartrate || '?'}bpm`;
	}).join('\n') : 'Pas de données laps disponibles';

	const splitsText = activity.splits_metric ? activity.splits_metric.map(s => {
		const pace = s.average_speed > 0 ? (1000 / s.average_speed / 60) : 0;
		const paceMin = Math.floor(pace);
		const paceSec = Math.round((pace - paceMin) * 60);
		return `  Km ${s.split}: allure ${paceMin}:${String(paceSec).padStart(2, '0')}/km, FC ${s.average_heartrate || '?'}bpm, D+ ${s.elevation_difference || 0}m`;
	}).join('\n') : '';

	// 5. Build prompt
	const prompt = `Tu es un coach de course à pied expérimenté. Analyse cette activité et donne un feedback constructif et encourageant en français.

## ACTIVITÉ RÉALISÉE
Nom : ${activity.name}
Date : ${actDate}
Sport : ${activity.sport_type}
Distance : ${activity.distance_m ? (activity.distance_m / 1000).toFixed(2) : '?'} km
Durée : ${activity.moving_time_s ? Math.round(activity.moving_time_s / 60) : '?'} min
Allure moyenne : ${activity.avg_speed_ms ? ((1000 / activity.avg_speed_ms / 60).toFixed(2)) : '?'} min/km
FC moyenne : ${activity.avg_hr || '?'} bpm
FC max : ${activity.max_hr || '?'} bpm
D+ : ${activity.elevation_gain || 0} m
RPE ressenti : ${activity.perceived_difficulty ? activity.perceived_difficulty + '/10' : 'non renseigné'}
Feeling : ${activity.perceived_feeling ? activity.perceived_feeling + '/7' : 'non renseigné'}
${activity.user_notes ? `Notes de l'athlète : "${activity.user_notes}"` : ''}

## LAPS (détail de la séance)
${lapsText}

${splitsText ? '## SPLITS KILOMÉTRIQUES\n' + splitsText : ''}

${plannedWorkout ? `## SÉANCE PRÉVUE PAR LE PLAN (${raceName})
Type : ${plannedWorkout.type} (${plannedWorkout.title})
Durée prévue : ${plannedWorkout.duration_min} min
Distance prévue : ${plannedWorkout.distance_km || '?'} km
Description : ${plannedWorkout.description}
` : '## Pas de séance planifiée pour ce jour'}

${profile ? `## PROFIL ATHLÈTE
Âge : ${profile.birth_date ? Math.floor((Date.now() - new Date(profile.birth_date)) / 31557600000) : '?'} ans
` : ''}

## INSTRUCTIONS
Donne un feedback en 3-5 phrases maximum. Sois concis et direct.
${plannedWorkout ? `Compare ce qui était prévu vs ce qui a été réalisé (distance, allure, durée).` : ''}
Analyse les laps pour comprendre la structure de la séance (régularité, gestion de l'effort, etc.).
Mentionne un point positif et éventuellement un axe d'amélioration.
Si le RPE ou feeling est renseigné, commente la cohérence entre données objectives et ressenti.
Si l'athlète a laissé des notes, prends-les en compte dans ton analyse.
Ne commence pas par "Bravo" ou des félicitations creuses. Sois factuel et constructif.`;

	try {
		const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': env.ANTHROPIC_API_KEY,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 500,
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!aiRes.ok) {
			const errText = await aiRes.text();
			return json({ error: `AI error: ${errText}` }, { status: 500 });
		}

		const aiData = await aiRes.json();
		const feedback = aiData.content?.[0]?.text || 'Pas de feedback disponible';

		// 6. Cache feedback
		await supabase
			.from('rt_activities')
			.update({
				ai_feedback: feedback,
				ai_feedback_at: new Date().toISOString()
			})
			.eq('id', params.id);

		return json({ feedback, cached: false });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}
