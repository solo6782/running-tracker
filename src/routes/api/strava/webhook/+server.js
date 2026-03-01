import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';
import { fetchActivity, getValidToken, mapStravaActivity } from '$lib/strava.js';

export async function GET({ url, platform }) {
	const env = getEnv(platform);
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	if (mode === 'subscribe' && token === env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
		console.log('Strava webhook validated');
		return json({ 'hub.challenge': challenge });
	}

	return new Response('Forbidden', { status: 403 });
}

export async function POST({ request, platform }) {
	const env = getEnv(platform);
	const event = await request.json();

	console.log('Strava webhook event:', JSON.stringify(event));

	if (event.object_type !== 'activity') {
		return json({ ok: true });
	}

	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const { data: users } = await supabaseAdmin
		.from('rt_users')
		.select('*')
		.eq('strava_athlete_id', event.owner_id)
		.limit(1);

	const user = users?.[0];
	if (!user) {
		console.error('User not found for athlete:', event.owner_id);
		return json({ ok: true });
	}

	try {
		if (event.aspect_type === 'create' || event.aspect_type === 'update') {
			const accessToken = await getValidToken(
				user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabaseAdmin
			);

			const stravaActivity = await fetchActivity(accessToken, event.object_id);
			const mapped = mapStravaActivity(stravaActivity, user.id);

			const { error } = await supabaseAdmin
				.from('rt_activities')
				.upsert(mapped, { onConflict: 'strava_id' });

			if (error) console.error('DB insert error:', error);
			else console.log('Activity synced:', stravaActivity.name);

		} else if (event.aspect_type === 'delete') {
			await supabaseAdmin
				.from('rt_activities')
				.delete()
				.eq('strava_id', event.object_id);

			console.log('Activity deleted:', event.object_id);
		}
	} catch (err) {
		console.error('Webhook processing error:', err);
	}

	return json({ ok: true });
}
