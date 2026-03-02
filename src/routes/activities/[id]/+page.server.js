import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';
import { error } from '@sveltejs/kit';

export async function load({ params, platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const { data, error: dbError } = await supabaseAdmin
		.from('rt_activities')
		.select('id, strava_id, sport_type, name, description, activity_date, elapsed_time_s, moving_time_s, distance_m, avg_hr, max_hr, calories, avg_speed_ms, max_speed_ms, avg_watts, weighted_avg_power, avg_cadence, max_cadence, training_load, elevation_gain, elevation_loss, elevation_low, elevation_high, summary_polyline, gear_name, perceived_difficulty, perceived_feeling, weather_temp, weather_condition, weather_humidity, weather_wind_speed, laps, splits_metric, best_efforts, ai_feedback, ai_feedback_at, streams')
		.eq('id', params.id)
		.single();

	if (dbError || !data) {
		throw error(404, 'Activité introuvable');
	}

	// Find planned workout for this activity's date
	const actDate = data.activity_date?.split('T')[0];
	let plannedWorkout = null;
	let planRaceName = null;

	if (actDate) {
		const { data: programmes } = await supabaseAdmin
			.from('rt_programmes')
			.select('race_name, availability')
			.eq('active', true);

		for (const prog of (programmes || [])) {
			const avail = prog.availability || {};
			if (avail[actDate]?.plan) {
				plannedWorkout = avail[actDate].plan;
				planRaceName = prog.race_name;
				break;
			}
		}
	}

	// Previous and next activities for navigation
	const { data: prevActivity } = await supabaseAdmin
		.from('rt_activities')
		.select('id')
		.lt('activity_date', data.activity_date)
		.order('activity_date', { ascending: false })
		.limit(1)
		.single();

	const { data: nextActivity } = await supabaseAdmin
		.from('rt_activities')
		.select('id')
		.gt('activity_date', data.activity_date)
		.order('activity_date', { ascending: true })
		.limit(1)
		.single();

	return {
		activity: data,
		plannedWorkout,
		planRaceName,
		prevId: prevActivity?.id || null,
		nextId: nextActivity?.id || null
	};
}
