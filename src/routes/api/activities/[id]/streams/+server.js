import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';
import { getValidToken } from '$lib/strava.js';

const MAX_STREAMS_CACHED = 10;
const STREAM_TYPES = ['heartrate', 'velocity_smooth', 'altitude', 'cadence', 'distance', 'time'];

export async function POST({ params, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	// 1. Get activity
	const { data: activity } = await supabase
		.from('rt_activities')
		.select('id, strava_id, streams, user_id')
		.eq('id', params.id)
		.single();

	if (!activity) return json({ error: 'Activité introuvable' }, { status: 404 });

	// 2. If already cached, return
	if (activity.streams) {
		return json({ streams: activity.streams, cached: true });
	}

	// 3. Get Strava token
	const { data: user } = await supabase
		.from('rt_users')
		.select('*')
		.limit(1)
		.single();

	if (!user) return json({ error: 'Utilisateur Strava non trouvé' }, { status: 400 });

	const accessToken = await getValidToken(user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabase);

	// 4. Fetch streams from Strava
	const typesParam = STREAM_TYPES.join(',');
	const res = await fetch(
		`https://www.strava.com/api/v3/activities/${activity.strava_id}/streams?keys=${typesParam}&key_by_type=true`,
		{ headers: { 'Authorization': `Bearer ${accessToken}` } }
	);

	if (!res.ok) {
		const errText = await res.text();
		return json({ error: `Strava API error: ${res.status} - ${errText}` }, { status: 500 });
	}

	const rawStreams = await res.json();

	// 5. Transform streams - keep only data arrays, downsample if too large
	const streams = {};
	const maxPoints = 1000; // Limit to ~1000 points to save storage

	for (const type of STREAM_TYPES) {
		if (rawStreams[type]?.data) {
			const data = rawStreams[type].data;
			if (data.length > maxPoints) {
				// Downsample: pick every Nth point + always keep first and last
				const step = Math.ceil(data.length / maxPoints);
				const sampled = [data[0]];
				for (let i = step; i < data.length - 1; i += step) {
					sampled.push(data[i]);
				}
				sampled.push(data[data.length - 1]);
				streams[type] = sampled;
			} else {
				streams[type] = data;
			}
		}
	}

	if (Object.keys(streams).length === 0) {
		return json({ error: 'Aucun stream disponible pour cette activité' }, { status: 404 });
	}

	// 6. Cache in DB
	await supabase
		.from('rt_activities')
		.update({ streams })
		.eq('id', params.id);

	// 7. Purge old streams (keep only MAX_STREAMS_CACHED most recent)
	try {
		const { data: activitiesWithStreams } = await supabase
			.from('rt_activities')
			.select('id, activity_date')
			.not('streams', 'is', null)
			.eq('user_id', activity.user_id)
			.order('activity_date', { ascending: false });

		if (activitiesWithStreams && activitiesWithStreams.length > MAX_STREAMS_CACHED) {
			const toPurge = activitiesWithStreams.slice(MAX_STREAMS_CACHED);
			const purgeIds = toPurge.map(a => a.id);
			await supabase
				.from('rt_activities')
				.update({ streams: null })
				.in('id', purgeIds);
		}
	} catch (e) {
		console.error('Stream purge error (non-critical):', e);
	}

	return json({ streams, cached: false });
}
