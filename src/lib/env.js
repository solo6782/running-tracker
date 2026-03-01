/**
 * Récupère les variables d'environnement depuis platform.env (Cloudflare Workers)
 * Centralise l'accès pour éviter les erreurs
 */
export function getEnv(platform) {
	const env = platform?.env || {};
	return {
		SUPABASE_URL: env.PUBLIC_SUPABASE_URL || '',
		SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || '',
		SUPABASE_ANON_KEY: env.PUBLIC_SUPABASE_ANON_KEY || '',
		STRAVA_CLIENT_ID: env.STRAVA_CLIENT_ID || '',
		STRAVA_CLIENT_SECRET: env.STRAVA_CLIENT_SECRET || '',
		STRAVA_WEBHOOK_VERIFY_TOKEN: env.STRAVA_WEBHOOK_VERIFY_TOKEN || '',
		APP_URL: env.PUBLIC_APP_URL || '',
		ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY || '',
		WITHINGS_CLIENT_ID: env.WITHINGS_CLIENT_ID || '',
		WITHINGS_CLIENT_SECRET: env.WITHINGS_CLIENT_SECRET || ''
	};
}
