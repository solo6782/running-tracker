import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';
import { getValidToken } from '$lib/strava.js';

export async function POST({ params, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	// 1. Get activity
	const { data: activity } = await supabase
		.from('rt_activities')
		.select('id, strava_id, laps, splits_metric, best_efforts')
		.eq('id', params.id)
		.single();

	if (!activity) return json({ error: 'Activité introuvable' }, { status: 404 });

	// 2. If already cached, return
	if (activity.laps) {
		return json({ laps: activity.laps, splits_metric: activity.splits_metric, best_efforts: activity.best_efforts, cached: true });
	}

	// 3. Get Strava token
	const { data: user } = await supabase
		.from('rt_users')
		.select('*')
		.limit(1)
		.single();

	if (!user) return json({ error: 'Utilisateur Strava non trouvé' }, { status: 400 });

	const accessToken = await getValidToken(user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabase);

	// 4. Fetch detail from Strava
	const res = await fetch(`https://www.strava.com/api/v3/activities/${activity.strava_id}`, {
		headers: { 'Authorization': `Bearer ${accessToken}` }
	});

	if (!res.ok) {
		return json({ error: `Strava API error: ${res.status}` }, { status: 500 });
	}

	const detail = await res.json();

	const laps = (detail.laps || []).map(l => ({
		name: l.name,
		elapsed_time: l.elapsed_time,
		moving_time: l.moving_time,
		distance: l.distance,
		average_speed: l.average_speed,
		max_speed: l.max_speed,
		average_heartrate: l.average_heartrate,
		max_heartrate: l.max_heartrate,
		average_cadence: l.average_cadence,
		lap_index: l.lap_index,
		total_elevation_gain: l.total_elevation_gain
	}));

	const splits = (detail.splits_metric || []).map(s => ({
		distance: s.distance,
		elapsed_time: s.elapsed_time,
		moving_time: s.moving_time,
		average_speed: s.average_speed,
		average_heartrate: s.average_heartrate,
		elevation_difference: s.elevation_difference,
		split: s.split
	}));

	const efforts = (detail.best_efforts || []).map(e => ({
		name: e.name,
		elapsed_time: e.elapsed_time,
		moving_time: e.moving_time,
		distance: e.distance
	}));

	// 5. Cache in DB
	await supabase
		.from('rt_activities')
		.update({
			laps: laps.length > 0 ? laps : null,
			splits_metric: splits.length > 0 ? splits : null,
			best_efforts: efforts.length > 0 ? efforts : null
		})
		.eq('id', params.id);

	return json({ laps, splits_metric: splits, best_efforts: efforts, cached: false });
}
