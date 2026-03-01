import { redirect } from '@sveltejs/kit';
import { getEnv } from '$lib/env.js';

export async function GET({ platform }) {
	const env = getEnv(platform);
	const clientId = env.WITHINGS_CLIENT_ID;
	const appUrl = env.APP_URL;

	if (!clientId) {
		return new Response('Withings non configuré', { status: 500 });
	}

	const state = crypto.randomUUID();
	const redirectUri = `${appUrl}/auth/withings/callback`;
	const scope = 'user.info,user.metrics,user.activity';

	const authUrl = `https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

	throw redirect(302, authUrl);
}
