import { createServerClient } from '$lib/supabase.js';
import { getStravaAuthUrl } from '$lib/strava.js';

export async function load({ platform }) {
	const env = platform?.env || {};

	const supabaseAdmin = createServerClient(env.SUPABASE_SERVICE_ROLE_KEY);

	// Vérifie si un utilisateur est déjà connecté (mono-utilisateur)
	const { data: users } = await supabaseAdmin
		.from('rt_users')
		.select('id, strava_athlete_id')
		.limit(1);

	const user = users?.[0] || null;
	const isConnected = !!user?.strava_athlete_id;

	// URL d'autorisation Strava
	const redirectUri = `${env.PUBLIC_APP_URL}/auth/strava/callback`;
	const stravaAuthUrl = getStravaAuthUrl(env.STRAVA_CLIENT_ID, redirectUri);

	return {
		isConnected,
		stravaAuthUrl,
		athleteId: user?.strava_athlete_id || null
	};
}
