import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { fetchActivity, getValidToken, mapStravaActivity } from '$lib/strava.js';

/**
 * GET — Validation du webhook par Strava
 * Strava envoie un challenge qu'on doit renvoyer pour confirmer l'abonnement
 */
export async function GET({ url, platform }) {
	const env = platform?.env || {};
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	if (mode === 'subscribe' && token === env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
		console.log('Strava webhook validated');
		return json({ 'hub.challenge': challenge });
	}

	return new Response('Forbidden', { status: 403 });
}

/**
 * POST — Réception des événements Strava
 * Appelé à chaque nouvelle activité, modification, ou suppression
 */
export async function POST({ request, platform }) {
	const env = platform?.env || {};
	const event = await request.json();

	console.log('Strava webhook event:', JSON.stringify(event));

	// On ne traite que les événements d'activité
	if (event.object_type !== 'activity') {
		return json({ ok: true });
	}

	const supabaseAdmin = createServerClient(env.SUPABASE_SERVICE_ROLE_KEY);

	// Récupère l'utilisateur via son athlete_id Strava
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
		if (event.aspect_type === 'create') {
			// Nouvelle activité
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

		} else if (event.aspect_type === 'update') {
			// Activité modifiée — on re-fetch et met à jour
			const accessToken = await getValidToken(
				user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabaseAdmin
			);

			const stravaActivity = await fetchActivity(accessToken, event.object_id);
			const mapped = mapStravaActivity(stravaActivity, user.id);

			await supabaseAdmin
				.from('rt_activities')
				.upsert(mapped, { onConflict: 'strava_id' });

		} else if (event.aspect_type === 'delete') {
			// Activité supprimée
			await supabaseAdmin
				.from('rt_activities')
				.delete()
				.eq('strava_id', event.object_id);

			console.log('Activity deleted:', event.object_id);
		}
	} catch (err) {
		console.error('Webhook processing error:', err);
	}

	// Toujours répondre 200 pour que Strava ne retry pas
	return json({ ok: true });
}
