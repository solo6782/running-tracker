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

	// 2b. Load Withings body composition from cache table
	let withingsData = null;
	let withingsHistory = null;

	const { data: withingsMeasures } = await supabase
		.from('rt_withings_measures')
		.select('*')
		.order('measure_date', { ascending: false })
		.limit(200);

	if (withingsMeasures && withingsMeasures.length > 0) {
		// Latest values
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

		// Full history for Claude
		withingsHistory = withingsMeasures.map(row => {
			const entry = { date: row.measure_date };
			for (const field of fields) {
				if (row[field] != null) entry[field] = Number(row[field]);
			}
			return entry;
		}).filter(e => Object.keys(e).length > 1);
	}

	// 3. Load training history (last 6 months of activities)
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

	const { data: recentActivities } = await supabase
		.from('rt_activities')
		.select('sport_type, name, activity_date, distance_m, moving_time_s, avg_speed_ms, avg_hr, max_hr, elevation_gain, perceived_difficulty, perceived_feeling')
		.gte('activity_date', sixMonthsAgo.toISOString())
		.order('activity_date', { ascending: false });

	// 4. Load ALL activities for global stats (first activity date, totals)
	const { data: allActivities } = await supabase
		.from('rt_activities')
		.select('sport_type, activity_date, distance_m, moving_time_s, avg_hr, elevation_gain, perceived_difficulty, perceived_feeling')
		.order('activity_date', { ascending: true });

	// 5. Compute summary stats
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

	const avgRPE = recentActivities?.length > 0
		? (recentActivities.filter(a => a.perceived_difficulty).reduce((s, a) => s + a.perceived_difficulty, 0) /
			recentActivities.filter(a => a.perceived_difficulty).length || 0).toFixed(1)
		: 'N/A';

	const avgFeeling = recentActivities?.length > 0
		? (recentActivities.filter(a => a.perceived_feeling).reduce((s, a) => s + a.perceived_feeling, 0) /
			recentActivities.filter(a => a.perceived_feeling).length || 0).toFixed(1)
		: 'N/A';

	// Recent 4 weeks detail
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

	// 6. Build availability summary
	const avail = programme.availability || {};
	const todayStr = new Date().toISOString().split('T')[0];
	const trainingDays = Object.entries(avail)
		.filter(([date, v]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayStr)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, v]) => ({
			date,
			run: v.run || false,
			ride: v.ride || false
		}));

	// 7. Compute age
	let age = null;
	if (profile?.date_of_birth) {
		const dob = new Date(profile.date_of_birth);
		const today = new Date();
		age = today.getFullYear() - dob.getFullYear();
		if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
			age--;
		}
	}

	// 8. Build the prompt
	const prompt = `Tu es un coach de course à pied expert. Tu dois générer un plan d'entraînement personnalisé.

## PROFIL ATHLÈTE
${age ? `- Âge : ${age} ans` : '- Âge : non renseigné'}
${profile?.weight_kg ? `- Poids : ${profile.weight_kg} kg` : withingsData?.weight_kg ? `- Poids : ${withingsData.weight_kg} kg (Withings)` : '- Poids : non renseigné'}
${profile?.height_cm ? `- Taille : ${profile.height_cm} cm` : ''}
${profile?.resting_hr ? `- FC repos : ${profile.resting_hr} bpm` : ''}
${profile?.max_hr ? `- FC max : ${profile.max_hr} bpm` : ''}
${profile?.notes ? `- Notes : ${profile.notes}` : ''}
${withingsData?.fat_ratio_pct ? `- Taux de graisse : ${withingsData.fat_ratio_pct}% (Withings)` : ''}
${withingsData?.muscle_mass_kg ? `- Masse musculaire : ${withingsData.muscle_mass_kg} kg (Withings)` : ''}
${withingsData?.bone_mass_kg ? `- Masse osseuse : ${withingsData.bone_mass_kg} kg (Withings)` : ''}
${withingsData?.fat_mass_kg ? `- Masse grasse : ${withingsData.fat_mass_kg} kg (Withings)` : ''}
${withingsData?.hydration_kg ? `- Hydratation : ${withingsData.hydration_kg} kg (Withings)` : ''}
${withingsData?.fat_free_mass_kg ? `- Masse maigre : ${withingsData.fat_free_mass_kg} kg (Withings)` : ''}

${withingsHistory && withingsHistory.length > 0 ? `## HISTORIQUE COMPOSITION CORPORELLE (Withings, 6 derniers mois)
${JSON.stringify(withingsHistory, null, 0)}
Analyse l'évolution du poids et de la composition corporelle pour adapter le plan.` : ''}

## HISTORIQUE SPORTIF
- Première activité enregistrée : ${firstActivity ? firstActivity.activity_date : 'aucune'}
- IMPORTANT : L'athlète a réellement débuté le sport au moment de sa première activité enregistrée. Avant, il ne faisait pas de sport.
- Total activités : ${totalActivities}
- Derniers 6 mois — courses : ${runActivities.length} (moy. ${avgWeeklyRuns}/sem, dist. moy. ${avgRunDist}km, allure moy. ${avgRunPace})
- Derniers 6 mois — vélo : ${rideActivities.length} (moy. ${avgWeeklyRides}/sem)
- RPE moyen récent : ${avgRPE}/10
- Ressenti moyen récent : ${avgFeeling}/7

## 4 DERNIÈRES SEMAINES (détail)
${JSON.stringify(last4WeeksSummary, null, 0)}

## OBJECTIF COURSE
- Course : ${programme.race_name}
- Date : ${programme.race_date}
- Distance : ${programme.race_distance_km} km
${programme.race_elevation_gain ? `- Dénivelé : D+${programme.race_elevation_gain}m` : ''}
${programme.race_profile ? `- Profil : ${programme.race_profile}` : ''}
- Objectif : ${programme.objective_type === 'time' ? `Temps cible ${programme.objective_time}` : 'Finir la course'}

${otherProgrammes && otherProgrammes.length > 0 ? `## AUTRES COURSES PRÉVUES
L'athlète a aussi d'autres courses prévues. Prends-les en compte dans la planification (récupération après une course, montée en charge progressive entre les courses) :
${otherProgrammes.map(p => `- ${p.race_name} : ${p.race_date} — ${p.race_distance_km}km${p.race_elevation_gain ? ` (D+${p.race_elevation_gain}m)` : ''}${p.race_profile ? ` — ${p.race_profile}` : ''}`).join('\n')}` : ''}

## DISPONIBILITÉS
Aujourd'hui : ${todayStr}
Jours disponibles (run = course possible, ride = vélo possible) :
${trainingDays.map(d => `${d.date}${d.date === todayStr ? ' (AUJOURD\'HUI)' : ''}: ${d.run && d.ride ? 'run ou vélo' : d.run ? 'run uniquement' : d.ride ? 'vélo uniquement' : 'REPOS OBLIGATOIRE — NE PAS PLANIFIER DE SÉANCE'}`).join('\n')}

## INSTRUCTIONS
Génère un plan d'entraînement pour CHAQUE jour disponible marqué "run", "vélo", ou "run ou vélo", Y COMPRIS le jour d'aujourd'hui.
NE GÉNÈRE AUCUNE SÉANCE pour les jours marqués "REPOS OBLIGATOIRE". Ne les inclus pas du tout dans le JSON.
Le plan doit être progressif, inclure de la variété (endurance fondamentale, seuil, fractionné, sortie longue, récupération, vélo cross-training).
Respecte les principes : pas plus de 3 séances intenses par semaine, sortie longue le week-end, repos avant la course.
Adapte l'intensité au niveau de l'athlète (débutant, intermédiaire, confirmé) basé sur son historique.

CONTRAINTE ALLURE IMPORTANTE : L'athlète ne peut physiquement pas courir en dessous de 6:50/km (même en endurance fondamentale). Ne prescris JAMAIS d'allure supérieure à 6:50/km. L'endurance fondamentale doit être entre 6:20 et 6:50/km, la récupération entre 6:30 et 6:50/km.

Pour chaque séance de course, inclus un champ "garmin_steps" avec les étapes structurées pour export Garmin.
Chaque étape a : step_type ("warmup", "interval", "cooldown", "recovery"), end_type ("time" ou "distance"), end_value (secondes ou mètres), et optionnellement pace_target avec min_per_km et max_per_km (ex: "6:00" et "6:30").
Pour les fractionnés, utilise un objet "repeat" avec "iterations" et "steps" (tableau d'étapes).

Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) avec cette structure :
{
  "level": "débutant" | "intermédiaire" | "confirmé",
  "weekly_volume_target": "ex: 25-35 km/semaine",
  "summary": "résumé du plan en 2-3 phrases",
  "plan": {
    "YYYY-MM-DD": {
      "sport": "run" | "ride" | "rest",
      "type": "easy" | "tempo" | "intervals" | "long" | "recovery" | "cross" | "rest",
      "title": "titre court en français",
      "duration_min": nombre,
      "distance_km": nombre ou null,
      "description": "description détaillée de la séance en français (allure, zones, etc.)",
      "intensity": "low" | "moderate" | "high",
      "garmin_steps": [
        { "step_type": "warmup", "end_type": "distance", "end_value": 1000 },
        { "step_type": "interval", "end_type": "time", "end_value": 1200, "pace_target": { "min_per_km": "5:30", "max_per_km": "6:00" } },
        { "step_type": "cooldown", "end_type": "distance", "end_value": 1000 },
        { "type": "repeat", "iterations": 4, "steps": [
          { "step_type": "interval", "end_type": "distance", "end_value": 400, "pace_target": { "min_per_km": "5:00", "max_per_km": "5:20" } },
          { "step_type": "recovery", "end_type": "time", "end_value": 90 }
        ]}
      ]
    }
  }
}

Notes sur garmin_steps :
- Toute séance run DOIT avoir garmin_steps (pas les séances vélo)
- Commence toujours par un warmup, termine par un cooldown
- Les allures ne doivent JAMAIS dépasser 6:50/km (contrainte physique de l'athlète)
- Pour l'endurance fondamentale : warmup 1km + interval principal (distance ou temps) + cooldown 1km
- Pour les fractionnés : warmup + repeat(n)[interval + recovery] + cooldown

Retourne UNIQUEMENT le JSON.`;

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
				max_tokens: 16000,
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
		let coachingResult;

		try {
			coachingResult = JSON.parse(cleaned);
		} catch (e) {
			console.error('Parse error:', cleaned.substring(0, 500));
			return json({ error: 'Erreur de parsing du plan' }, { status: 500 });
		}

		// 9. Merge plan into availability (skip rest days)
		const updatedAvailability = { ...avail };
		for (const [date, plan] of Object.entries(coachingResult.plan || {})) {
			const existing = updatedAvailability[date];
			// Skip rest days (both run and ride are false)
			if (existing && !existing.run && !existing.ride) continue;
			if (existing) {
				updatedAvailability[date].plan = plan;
			} else {
				updatedAvailability[date] = { run: true, ride: true, plan };
			}
		}

		// 10. Save to Supabase
		await supabase
			.from('rt_programmes')
			.update({
				availability: updatedAvailability,
				updated_at: new Date().toISOString()
			})
			.eq('id', programmeId);

		return json({
			success: true,
			level: coachingResult.level,
			weekly_volume_target: coachingResult.weekly_volume_target,
			summary: coachingResult.summary,
			availability: updatedAvailability
		});
	} catch (err) {
		console.error('Coaching error:', err);
		return json({ error: `Erreur: ${err.message}` }, { status: 500 });
	}
}
