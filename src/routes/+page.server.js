import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';
import { getStravaAuthUrl } from '$lib/strava.js';

export async function load({ platform }) {
	const env = getEnv(platform);

	// Si pas de config Supabase, on affiche quand même la page
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		return {
			isConnected: false,
			stravaAuthUrl: '#',
			athleteId: null,
			activityCount: 0,
			error: 'Configuration Supabase manquante. Vérifiez les variables d\'environnement.'
		};
	}

	try {
		const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		const { data: users, error: dbError } = await supabaseAdmin
			.from('rt_users')
			.select('id, strava_athlete_id')
			.limit(1);

		if (dbError) {
			return {
				isConnected: false,
				stravaAuthUrl: '#',
				athleteId: null,
				activityCount: 0,
				error: `Erreur DB: ${dbError.message}`
			};
		}

		const user = users?.[0] || null;
		const isConnected = !!user?.strava_athlete_id;

		const redirectUri = `${env.APP_URL}/auth/strava/callback`;
		const stravaAuthUrl = getStravaAuthUrl(env.STRAVA_CLIENT_ID, redirectUri);

		// Compter les activités
		let activityCount = 0;
		if (isConnected) {
			const { count } = await supabaseAdmin
				.from('rt_activities')
				.select('id', { count: 'exact', head: true });
			activityCount = count || 0;
		}

		return {
			isConnected,
			stravaAuthUrl,
			athleteId: user?.strava_athlete_id || null,
			activityCount,
			error: null
		};
	} catch (err) {
		return {
			isConnected: false,
			stravaAuthUrl: '#',
			athleteId: null,
			activityCount: 0,
			error: `Erreur: ${err.message}`
		};
	}
}
