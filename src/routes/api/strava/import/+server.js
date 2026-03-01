import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { fetchActivitiesPage, getValidToken, mapStravaActivity } from '$lib/strava.js';

/**
 * POST — Import initial de tout l'historique Strava
 * Pagine à travers toutes les activités (100 par page) et les insère en base
 */
export async function POST({ platform }) {
	const env = platform?.env || {};
	const supabaseAdmin = createServerClient(env.SUPABASE_SERVICE_ROLE_KEY);

	// Récupère l'utilisateur (mono-utilisateur)
	const { data: users } = await supabaseAdmin
		.from('rt_users')
		.select('*')
		.limit(1);

	const user = users?.[0];
	if (!user) {
		return json({ success: false, error: 'No user found. Connect Strava first.' }, { status: 400 });
	}

	try {
		const accessToken = await getValidToken(
			user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabaseAdmin
		);

		let page = 1;
		let totalImported = 0;
		let hasMore = true;

		while (hasMore) {
			const activities = await fetchActivitiesPage(accessToken, page, 100);

			if (!activities.length) {
				hasMore = false;
				break;
			}

			// Mappe et insère les activités par batch
			const mapped = activities.map((a) => mapStravaActivity(a, user.id));

			const { error } = await supabaseAdmin
				.from('rt_activities')
				.upsert(mapped, { onConflict: 'strava_id' });

			if (error) {
				console.error(`Import page ${page} error:`, error);
			}

			totalImported += activities.length;
			console.log(`Imported page ${page}: ${activities.length} activities (total: ${totalImported})`);

			// Strava retourne moins de 100 = dernière page
			if (activities.length < 100) {
				hasMore = false;
			}

			page++;

			// Petit délai pour respecter le rate limit Strava (100 req/15min)
			if (page % 10 === 0) {
				await new Promise((r) => setTimeout(r, 2000));
			}
		}

		return json({ success: true, count: totalImported });
	} catch (err) {
		console.error('Import error:', err);
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
