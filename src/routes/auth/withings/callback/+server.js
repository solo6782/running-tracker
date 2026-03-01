import { redirect } from '@sveltejs/kit';
import { getEnv } from '$lib/env.js';
import { createServerClient } from '$lib/supabase.js';
import { exchangeCodeForTokens } from '$lib/withings.js';

export async function GET({ url, platform }) {
	const env = getEnv(platform);
	const code = url.searchParams.get('code');

	if (!code) {
		throw redirect(302, '/programme?withings=error&reason=no_code');
	}

	const clientId = env.WITHINGS_CLIENT_ID;
	const clientSecret = env.WITHINGS_CLIENT_SECRET;
	const redirectUri = `${env.APP_URL}/auth/withings/callback`;

	try {
		const tokens = await exchangeCodeForTokens(code, redirectUri, clientId, clientSecret);

		// Store tokens in Supabase
		const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		// Upsert: delete old then insert
		await supabase.from('rt_withings_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');

		await supabase.from('rt_withings_tokens').insert({
			withings_userid: String(tokens.userid),
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
			scope: tokens.scope
		});

		throw redirect(302, '/programme?withings=connected');
	} catch (err) {
		if (err?.status === 302) throw err; // re-throw redirect
		console.error('Withings callback error:', err);
		throw redirect(302, `/programme?withings=error&reason=${encodeURIComponent(err.message)}`);
	}
}
