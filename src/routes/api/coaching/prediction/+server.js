import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function POST({ request, platform }) {
	const env = getEnv(platform);
	const body = await request.json();
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	// 1. Get programme data - from DB or from request body
	let programme;
	if (body.programmeId) {
		const { data } = await supabase
			.from('rt_programmes')
			.select('*')
			.eq('id', body.programmeId)
			.single();
		programme = data;
	}

	if (!programme) {
		// Use direct race details from request
		programme = {
			race_name: body.race_name || 'Course',
			race_date: body.race_date || '',
			race_distance_km: body.race_distance_km || 21.1,
			race_elevation_gain: body.race_elevation_gain || null,
			race_profile: body.race_profile || '',
			objective_type: body.objective_type || 'finish',
			objective_time: body.objective_time || ''
		};
	}

	// 2. Get profile
	const { data: profile } = await supabase
		.from('rt_profile')
		.select('*')
		.limit(1)
		.single();

	// 3. Get recent activities (6 months)
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
	const { data: activities } = await supabase
		.from('rt_activities')
		.select('sport_type, name, activity_date, distance_m, moving_time_s, avg_speed_ms, avg_hr, max_hr, elevation_gain, perceived_difficulty, perceived_feeling, user_notes, hr_zones')
		.gte('activity_date', sixMonthsAgo.toISOString())
		.order('activity_date', { ascending: false });

	// 4. Find race-like efforts (long runs, actual races)
	const longRuns = (activities || []).filter(a =>
		a.sport_type === 'Run' && a.distance_m > 8000
	).slice(0, 10);

	const races = (activities || []).filter(a =>
		a.sport_type === 'Run' && a.distance_m > 15000
	).slice(0, 5);

	// 5. Compute stats
	const runActivities = (activities || []).filter(a => a.sport_type === 'Run');
	const avgPace = runActivities.length > 0
		? runActivities.reduce((s, a) => s + (a.avg_speed_ms || 0), 0) / runActivities.length
		: 0;

	// Find max HR across all activities
	const maxHR = Math.max(...(activities || []).filter(a => a.max_hr).map(a => a.max_hr), 0);

	// Age
	let age = null;
	if (profile?.date_of_birth) {
		const dob = new Date(profile.date_of_birth);
		const today = new Date();
		age = today.getFullYear() - dob.getFullYear();
		if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
	}

	// 6. Build prompt
	const prompt = `Tu es un expert en physiologie de l'exercice et prédiction de performance en course à pied.
Analyse les données ci-dessous et estime une FOURCHETTE DE TEMPS RÉALISTE pour la course cible.

## COURSE CIBLE
- Nom : ${programme.race_name}
- Date : ${programme.race_date}
- Distance : ${programme.race_distance_km} km
${programme.race_elevation_gain ? `- Dénivelé : D+${programme.race_elevation_gain}m` : ''}
${programme.race_profile ? `- Profil : ${programme.race_profile}` : ''}
- Objectif déclaré : ${programme.objective_type === 'time' ? programme.objective_time : 'Finir la course'}

## PROFIL ATHLÈTE
${age ? `- Âge : ${age} ans` : ''}
${profile?.weight_kg ? `- Poids : ${profile.weight_kg} kg` : ''}
${profile?.height_cm ? `- Taille : ${profile.height_cm} cm` : ''}
${profile?.resting_hr ? `- FC repos : ${profile.resting_hr} bpm` : ''}
${maxHR ? `- FC max observée : ${maxHR} bpm` : ''}

## COURSES ET SORTIES LONGUES RÉCENTES
${races.map(a => {
	const pace = a.avg_speed_ms > 0 ? (1000 / a.avg_speed_ms / 60) : 0;
	const paceMin = Math.floor(pace);
	const paceSec = Math.round((pace - paceMin) * 60);
	return `- ${a.activity_date?.split('T')[0]} "${a.name}": ${(a.distance_m/1000).toFixed(1)}km en ${Math.floor(a.moving_time_s/3600)}h${String(Math.floor((a.moving_time_s%3600)/60)).padStart(2,'0')}, allure ${paceMin}:${String(paceSec).padStart(2,'0')}/km, FC moy ${a.avg_hr || '?'}, D+ ${a.elevation_gain || 0}m${a.user_notes ? ` — Note: "${a.user_notes}"` : ''}`;
}).join('\n')}

## SORTIES LONGUES (>8km)
${longRuns.map(a => {
	const pace = a.avg_speed_ms > 0 ? (1000 / a.avg_speed_ms / 60) : 0;
	const paceMin = Math.floor(pace);
	const paceSec = Math.round((pace - paceMin) * 60);
	return `- ${a.activity_date?.split('T')[0]}: ${(a.distance_m/1000).toFixed(1)}km, ${paceMin}:${String(paceSec).padStart(2,'0')}/km, FC ${a.avg_hr || '?'}bpm, RPE ${a.perceived_difficulty || '?'}/10`;
}).join('\n')}

## VOLUME D'ENTRAÎNEMENT
- Nombre de runs (6 mois) : ${runActivities.length}
- Distance totale : ${(runActivities.reduce((s,a) => s + (a.distance_m || 0), 0) / 1000).toFixed(0)} km

## MÉTHODE D'ESTIMATION
Utilise plusieurs méthodes croisées :
1. Extrapolation depuis les courses récentes (Riegel formula: T2 = T1 × (D2/D1)^1.06)
2. Estimation depuis la VMA déduite du VO2max ou des vitesses d'entraînement
3. Ajustement pour le dénivelé de la course cible vs les courses passées
4. Prise en compte du poids, de l'âge, de la FC max, et de la progression récente
5. Les notes de l'athlète sur ses courses (sensations, problèmes, etc.)

## FORMAT DE RÉPONSE
Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) :
{
  "optimistic": "H:MM:SS",
  "realistic": "H:MM:SS",
  "conservative": "H:MM:SS",
  "target_pace_per_km": "M:SS",
  "confidence": "faible" | "moyenne" | "élevée",
  "analysis": "Explication en 3-5 phrases de comment tu arrives à cette estimation, les facteurs clés, et les risques.",
  "strategy": "Conseil de stratégie de course en 2-3 phrases (allure de départ, gestion des km, finish)."
}`;

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
				max_tokens: 800,
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!aiRes.ok) {
			const errText = await aiRes.text();
			return json({ error: `AI error: ${errText}` }, { status: 500 });
		}

		const aiData = await aiRes.json();
		const rawText = aiData.content?.[0]?.text || '';

		// Parse JSON
		const clean = rawText.replace(/```json|```/g, '').trim();
		const prediction = JSON.parse(clean);

		return json({ success: true, prediction });
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
}
