import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';
import { getValidToken, fetchActivity, mapStravaActivity } from '$lib/strava.js';

// GET: Check webhook subscription status + show recent Strava activities not yet imported
export async function GET({ url, platform }) {
	const env = getEnv(platform);
	const result = {};

	// 1. Check existing webhook subscriptions
	try {
		const subRes = await fetch(
			`https://www.strava.com/api/v3/push_subscriptions?client_id=${env.STRAVA_CLIENT_ID}&client_secret=${env.STRAVA_CLIENT_SECRET}`
		);
		result.subscriptions = await subRes.json();
		result.subscriptionStatus = Array.isArray(result.subscriptions) && result.subscriptions.length > 0
			? 'active' : 'none';
	} catch (err) {
		result.subscriptionError = err.message;
	}

	// 2. Check for missing activities
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
	const { data: user } = await supabase.from('rt_users').select('*').limit(1).single();

	if (user) {
		try {
			const accessToken = await getValidToken(user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabase);
			const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
				headers: { 'Authorization': `Bearer ${accessToken}` }
			});
			const recentStrava = await stravaRes.json();

			// Check which are already in DB
			const stravaIds = recentStrava.map(a => a.id);
			const { data: existing } = await supabase
				.from('rt_activities')
				.select('strava_id')
				.in('strava_id', stravaIds);

			const existingIds = new Set((existing || []).map(e => e.strava_id));
			result.recentStrava = recentStrava.map(a => ({
				id: a.id,
				name: a.name,
				date: a.start_date_local,
				type: a.sport_type,
				imported: existingIds.has(a.id)
			}));
			result.missingCount = result.recentStrava.filter(a => !a.imported).length;
		} catch (err) {
			result.stravaError = err.message;
		}
	}

	result.callbackUrl = `https://running-tracker.solo6782.workers.dev/api/strava/webhook`;
	result.hasVerifyToken = !!env.STRAVA_WEBHOOK_VERIFY_TOKEN;

	return json(result);
}

// POST: action=subscribe → create webhook, action=sync → import missing activities
export async function POST({ request, platform }) {
	const env = getEnv(platform);
	const body = await request.json();
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	if (body.action === 'subscribe') {
		// Create webhook subscription
		const callbackUrl = `https://running-tracker.solo6782.workers.dev/api/strava/webhook`;
		const verifyToken = env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'running-tracker-verify';

		try {
			const formData = new URLSearchParams();
			formData.append('client_id', env.STRAVA_CLIENT_ID);
			formData.append('client_secret', env.STRAVA_CLIENT_SECRET);
			formData.append('callback_url', callbackUrl);
			formData.append('verify_token', verifyToken);

			const res = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
				method: 'POST',
				body: formData
			});

			const result = await res.json();
			return json({ action: 'subscribe', status: res.status, result });
		} catch (err) {
			return json({ action: 'subscribe', error: err.message }, { status: 500 });
		}

	} else if (body.action === 'sync') {
		// Import missing recent activities
		const { data: user } = await supabase.from('rt_users').select('*').limit(1).single();
		if (!user) return json({ error: 'No user found' }, { status: 400 });

		const accessToken = await getValidToken(user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabase);

		const stravaRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
			headers: { 'Authorization': `Bearer ${accessToken}` }
		});
		const activities = await stravaRes.json();

		const stravaIds = activities.map(a => a.id);
		const { data: existing } = await supabase
			.from('rt_activities')
			.select('strava_id')
			.in('strava_id', stravaIds);
		const existingIds = new Set((existing || []).map(e => e.strava_id));

		let imported = 0;
		for (const act of activities) {
			if (existingIds.has(act.id)) continue;
			try {
				const detail = await fetchActivity(accessToken, act.id);
				const mapped = mapStravaActivity(detail, user.id);
				await supabase.from('rt_activities').upsert(mapped, { onConflict: 'strava_id' });
				imported++;
			} catch (err) {
				console.error(`Failed to import ${act.id}:`, err);
			}
		}

		return json({ action: 'sync', imported, total: activities.length });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
}
