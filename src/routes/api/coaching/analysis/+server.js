import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function POST({ request, platform }) {
	const env = getEnv(platform);
	const anthropicKey = env.ANTHROPIC_API_KEY;
	if (!anthropicKey) {
		return json({ error: 'Clé API Anthropic non configurée' }, { status: 500 });
	}

	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
	const { programmeId } = await request.json();

	// 1. Load programme
	const { data: programme } = await supabase
		.from('rt_programmes')
		.select('*')
		.eq('id', programmeId)
		.single();

	if (!programme) {
		return json({ error: 'Programme non trouvé' }, { status: 404 });
	}

	// 1b. Load other active programmes for context
	const { data: otherProgrammes } = await supabase
		.from('rt_programmes')
		.select('race_name, race_date, race_distance_km, race_elevation_gain, race_profile')
		.eq('is_active', true)
		.neq('id', programmeId)
		.order('race_date', { ascending: true });

	// 2. Load athlete profile
	const { data: profile } = await supabase
		.from('rt_athlete_profile')
		.select('*')
		.limit(1)
		.single();

	// 3. Load Withings from cache
	let withingsData = null;
	let withingsHistory = null;

	const { data: withingsMeasures } = await supabase
		.from('rt_withings_measures')
		.select('*')
		.order('measure_date', { ascending: false })
		.limit(200);

	if (withingsMeasures && withingsMeasures.length > 0) {
		const latestValues = {};
		const fields = ['weight_kg', 'fat_ratio_pct', 'fat_mass_kg', 'fat_free_mass_kg', 'muscle_mass_kg', 'bone_mass_kg', 'hydration_kg'];
		for (const field of fields) {
			for (const row of withingsMeasures) {
				if (row[field] != null) {
					latestValues[field] = Number(row[field]);
					break;
				}
			}
		}
		withingsData = latestValues;

		withingsHistory = withingsMeasures.map(row => {
			const entry = { date: row.measure_date };
			for (const field of fields) {
				if (row[field] != null) entry[field] = Number(row[field]);
			}
			return entry;
		}).filter(e => Object.keys(e).length > 1);
	}

	// 4. Load activities
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

	const { data: recentActivities } = await supabase
		.from('rt_activities')
		.select('sport_type, name, activity_date, distance_m, moving_time_s, avg_speed_ms, avg_hr, max_hr, elevation_gain, perceived_difficulty, perceived_feeling, laps')
		.gte('activity_date', sixMonthsAgo.toISOString())
		.order('activity_date', { ascending: false });

	const { data: allActivities } = await supabase
		.from('rt_activities')
		.select('sport_type, activity_date, distance_m, moving_time_s, avg_hr, elevation_gain, perceived_difficulty, perceived_feeling')
		.order('activity_date', { ascending: true });

	// 5. Stats
	const firstActivity = allActivities?.[0];
	const totalActivities = allActivities?.length || 0;

	const runActivities = (recentActivities || []).filter(a => a.sport_type === 'Run');
	const rideActivities = (recentActivities || []).filter(a => ['Ride', 'VirtualRide'].includes(a.sport_type));

	const avgWeeklyRuns = runActivities.length > 0 ? (runActivities.length / 26).toFixed(1) : 0;
	const avgWeeklyRides = rideActivities.length > 0 ? (rideActivities.length / 26).toFixed(1) : 0;

	const avgRunDist = runActivities.length > 0
		? (runActivities.reduce((s, a) => s + (a.distance_m || 0), 0) / runActivities.length / 1000).toFixed(1)
		: 0;

	const avgRunPace = runActivities.length > 0
		? (() => {
			const totalTime = runActivities.reduce((s, a) => s + (a.moving_time_s || 0), 0);
			const totalDist = runActivities.reduce((s, a) => s + (a.distance_m || 0), 0);
			if (totalDist === 0) return 'N/A';
			const paceS = totalTime / (totalDist / 1000);
			return `${Math.floor(paceS / 60)}:${String(Math.round(paceS % 60)).padStart(2, '0')}/km`;
		})()
		: 'N/A';

	// Longest run
	const longestRun = runActivities.length > 0
		? Math.max(...runActivities.map(a => (a.distance_m || 0) / 1000)).toFixed(1)
		: 0;

	// Best pace (min/km)
	const bestPace = runActivities.length > 0
		? (() => {
			const paces = runActivities
				.filter(a => a.distance_m > 2000 && a.moving_time_s > 0)
				.map(a => a.moving_time_s / (a.distance_m / 1000));
			if (paces.length === 0) return 'N/A';
			const best = Math.min(...paces);
			return `${Math.floor(best / 60)}:${String(Math.round(best % 60)).padStart(2, '0')}/km`;
		})()
		: 'N/A';

	const avgRPE = recentActivities?.length > 0
		? (recentActivities.filter(a => a.perceived_difficulty).reduce((s, a) => s + a.perceived_difficulty, 0) /
			recentActivities.filter(a => a.perceived_difficulty).length || 0).toFixed(1)
		: 'N/A';

	const avgFeeling = recentActivities?.length > 0
		? (recentActivities.filter(a => a.perceived_feeling).reduce((s, a) => s + a.perceived_feeling, 0) /
			recentActivities.filter(a => a.perceived_feeling).length || 0).toFixed(1)
		: 'N/A';

	// Last 4 weeks
	const fourWeeksAgo = new Date();
	fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
	const last4Weeks = (recentActivities || []).filter(a => new Date(a.activity_date) >= fourWeeksAgo);

	const last4WeeksSummary = last4Weeks.map(a => ({
		date: a.activity_date,
		sport: a.sport_type,
		dist_km: a.distance_m ? (a.distance_m / 1000).toFixed(1) : 0,
		duration_min: a.moving_time_s ? Math.round(a.moving_time_s / 60) : 0,
		avg_hr: a.avg_hr || null,
		rpe: a.perceived_difficulty || null,
		feeling: a.perceived_feeling || null
	}));

	// Detail laps for last 5 activities that have them
	const activitiesWithLaps = last4Weeks
		.filter(a => a.laps && a.laps.length > 0)
		.slice(0, 5)
		.map(a => ({
			date: a.activity_date?.split('T')[0],
			name: a.name,
			sport: a.sport_type,
			laps: a.laps.map((l, i) => {
				const pace = l.average_speed > 0 ? (1000 / l.average_speed / 60) : 0;
				const paceMin = Math.floor(pace);
				const paceSec = Math.round((pace - paceMin) * 60);
				return `${l.name || 'Lap ' + (i+1)}: ${(l.distance/1000).toFixed(2)}km, ${paceMin}:${String(paceSec).padStart(2,'0')}/km, FC ${l.average_heartrate ? Math.round(l.average_heartrate) : '?'}bpm`;
			})
		}));

	// 6. Age
	let age = null;
	if (profile?.date_of_birth) {
		const dob = new Date(profile.date_of_birth);
		const today = new Date();
		age = today.getFullYear() - dob.getFullYear();
		if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
			age--;
		}
	}

	// Days until race
	const daysUntilRace = Math.ceil((new Date(programme.race_date) - new Date()) / (1000 * 60 * 60 * 24));

	// 7. Build analysis prompt
	const prompt = `Tu es un coach de course à pied expert et bienveillant. Tu dois analyser la préparation de cet athlète pour sa course et donner ton avis honnête.

## PROFIL ATHLÈTE
${age ? `- Âge : ${age} ans` : '- Âge : non renseigné'}
${withingsData?.weight_kg ? `- Poids : ${withingsData.weight_kg} kg (Withings)` : profile?.weight_kg ? `- Poids : ${profile.weight_kg} kg` : '- Poids : non renseigné'}
${profile?.height_cm ? `- Taille : ${profile.height_cm} cm` : ''}
${profile?.resting_hr ? `- FC repos : ${profile.resting_hr} bpm` : ''}
${profile?.max_hr ? `- FC max : ${profile.max_hr} bpm` : ''}
${profile?.notes ? `- Notes : ${profile.notes}` : ''}
${withingsData?.fat_ratio_pct ? `- Taux de graisse : ${withingsData.fat_ratio_pct}%` : ''}
${withingsData?.muscle_mass_kg ? `- Masse musculaire : ${withingsData.muscle_mass_kg} kg` : ''}
${withingsData?.fat_mass_kg ? `- Masse grasse : ${withingsData.fat_mass_kg} kg` : ''}
${withingsData?.hydration_kg ? `- Hydratation : ${withingsData.hydration_kg} kg` : ''}

${withingsHistory && withingsHistory.length > 0 ? `## ÉVOLUTION CORPORELLE (6 derniers mois)
${JSON.stringify(withingsHistory, null, 0)}` : ''}

## HISTORIQUE SPORTIF GLOBAL
- Première activité enregistrée : ${firstActivity ? firstActivity.activity_date : 'aucune'}
- IMPORTANT : L'athlète a débuté le sport à cette date. Avant, il ne faisait rien.
- Total activités : ${totalActivities}
- Courses (6 mois) : ${runActivities.length} — moy. ${avgWeeklyRuns}/sem, dist. moy. ${avgRunDist}km, allure moy. ${avgRunPace}
- Plus longue course : ${longestRun} km
- Meilleure allure : ${bestPace}
- Vélo (6 mois) : ${rideActivities.length} — moy. ${avgWeeklyRides}/sem
- RPE moyen : ${avgRPE}/10
- Ressenti moyen : ${avgFeeling}/7

## 4 DERNIÈRES SEMAINES (détail séance par séance)
${JSON.stringify(last4WeeksSummary, null, 0)}

${activitiesWithLaps.length > 0 ? `## DÉTAIL DES LAPS (séances récentes avec chronologie)
${activitiesWithLaps.map(a => `${a.date} — ${a.name} (${a.sport}):\n${a.laps.join('\n')}`).join('\n\n')}
Utilise ces laps pour évaluer la qualité d'exécution des séances (régularité, gestion de l'effort, tenue des allures).` : ''}

## OBJECTIF
- Course : ${programme.race_name}
- Date : ${programme.race_date} (dans ${daysUntilRace} jours)
- Distance : ${programme.race_distance_km} km
${programme.race_elevation_gain ? `- Dénivelé : D+${programme.race_elevation_gain}m` : ''}
${programme.race_profile ? `- Profil du parcours : ${programme.race_profile}` : ''}
${programme.race_location ? `- Lieu : ${programme.race_location}` : ''}
- Objectif : ${programme.objective_type === 'time' ? `Temps cible ${programme.objective_time}` : 'Finir la course'}

${otherProgrammes && otherProgrammes.length > 0 ? `## AUTRES COURSES PRÉVUES
${otherProgrammes.map(p => `- ${p.race_name} : ${p.race_date} — ${p.race_distance_km}km${p.race_elevation_gain ? ` (D+${p.race_elevation_gain}m)` : ''}${p.race_profile ? ` — ${p.race_profile}` : ''}`).join('\n')}
Mentionne brièvement comment ces courses impactent la préparation de la course analysée.` : ''}

## INSTRUCTIONS
Donne ton analyse complète en français, de manière directe et honnête mais bienveillante. Prends en compte le profil du parcours (dénivelé, terrain) dans ton estimation de temps et ton analyse. Couvre ces points :

1. **État de forme actuel** : analyse du volume, de la régularité, des allures, du RPE/ressenti
2. **Composition corporelle** : commentaire sur le poids et son évolution si données disponibles
3. **Chances d'atteindre l'objectif** : sois réaliste, donne un pourcentage de confiance et explique
4. **Points forts** de la préparation
5. **Points faibles / risques** : manques, faiblesses, vigilances
6. **Estimation de temps probable** sur la course (fourchette réaliste)
7. **Conseils pour les derniers jours** avant la course

Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) :
{
  "readiness_score": nombre de 1 à 100 (ta confiance dans sa préparation),
  "readiness_label": "🔴 Insuffisant" | "🟠 Limite" | "🟡 Correct" | "🟢 Bon" | "🟣 Excellent",
  "estimated_time": "ex: 2h05 - 2h15",
  "analysis": "ton analyse complète en texte libre, en français, 4-6 paragraphes. Utilise un ton direct, coach sportif, tutoie l'athlète."
}`;

	try {
		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': anthropicKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 4000,
				messages: [{ role: 'user', content: prompt }]
			})
		});

		if (!response.ok) {
			const err = await response.text();
			console.error('Anthropic error:', err);
			return json({ error: 'Erreur API Anthropic' }, { status: 502 });
		}

		const data = await response.json();
		const textContent = data.content
			.filter(b => b.type === 'text')
			.map(b => b.text)
			.join('');

		const cleaned = textContent.replace(/```json|```/g, '').trim();
		let result;

		try {
			result = JSON.parse(cleaned);
		} catch (e) {
			console.error('Parse error:', cleaned.substring(0, 500));
			return json({ error: 'Erreur de parsing de l\'analyse' }, { status: 500 });
		}

		// Save analysis in programme
		const analysisData = {
			...result,
			generated_at: new Date().toISOString()
		};

		const updatedAvailability = {
			...(programme.availability || {}),
			_ai_analysis: analysisData
		};

		await supabase
			.from('rt_programmes')
			.update({
				availability: updatedAvailability,
				updated_at: new Date().toISOString()
			})
			.eq('id', programmeId);

		return json({ success: true, ...analysisData });
	} catch (err) {
		console.error('Analysis error:', err);
		return json({ error: `Erreur: ${err.message}` }, { status: 500 });
	}
}
