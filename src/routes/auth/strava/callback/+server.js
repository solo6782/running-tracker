import { redirect } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { exchangeToken } from '$lib/strava.js';

export async function GET({ url, platform }) {
	const env = platform?.env || {};
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	if (error || !code) {
		throw redirect(302, '/?error=strava_denied');
	}

	try {
		// Échange le code contre un token
		const tokenData = await exchangeToken(
			env.STRAVA_CLIENT_ID,
			env.STRAVA_CLIENT_SECRET,
			code
		);

		const supabaseAdmin = createServerClient(env.SUPABASE_SERVICE_ROLE_KEY);

		// Upsert l'utilisateur
		const { error: dbError } = await supabaseAdmin
			.from('rt_users')
			.upsert({
				strava_athlete_id: tokenData.athlete.id,
				strava_access_token: tokenData.access_token,
				strava_refresh_token: tokenData.refresh_token,
				strava_token_expires_at: new Date(tokenData.expires_at * 1000).toISOString()
			}, {
				onConflict: 'strava_athlete_id'
			});

		if (dbError) {
			console.error('DB error:', dbError);
			throw redirect(302, '/?error=db_error');
		}

		throw redirect(302, '/?connected=true');
	} catch (err) {
		if (err.status === 302) throw err; // Re-throw redirects
		console.error('OAuth error:', err);
		throw redirect(302, '/?error=oauth_failed');
	}
}
