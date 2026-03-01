import { createServerClient } from '$lib/supabase.js';
import { getStravaAuthUrl } from '$lib/strava.js';

export async function load({ platform }) {
	const env = platform?.env || {};

	const supabaseUrl = env.PUBLIC_SUPABASE_URL;
	const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
	const supabaseAdmin = createServerClient(supabaseUrl, supabaseKey);

	const { data: users } = await supabaseAdmin
		.from('rt_users')
		.select('id, strava_athlete_id')
		.limit(1);

	const user = users?.[0] || null;
	const isConnected = !!user?.strava_athlete_id;

	const redirectUri = `${env.PUBLIC_APP_URL}/auth/strava/callback`;
	const stravaAuthUrl = getStravaAuthUrl(env.STRAVA_CLIENT_ID, redirectUri);

	return {
		isConnected,
		stravaAuthUrl,
		athleteId: user?.strava_athlete_id || null
	};
}
