const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_OAUTH = 'https://www.strava.com/oauth';

export function getStravaAuthUrl(clientId, redirectUri) {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'read,activity:read_all',
		approval_prompt: 'auto'
	});
	return `${STRAVA_OAUTH}/authorize?${params}`;
}

export async function exchangeToken(clientId, clientSecret, code) {
	const res = await fetch(`${STRAVA_OAUTH}/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code,
			grant_type: 'authorization_code'
		})
	});
	if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
	return res.json();
}

export async function refreshToken(clientId, clientSecret, refToken) {
	const res = await fetch(`${STRAVA_OAUTH}/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refToken,
			grant_type: 'refresh_token'
		})
	});
	if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
	return res.json();
}

export async function getValidToken(user, clientId, clientSecret, supabaseAdmin) {
	const now = new Date();
	const expiresAt = new Date(user.strava_token_expires_at);

	if (now < expiresAt) {
		return user.strava_access_token;
	}

	const data = await refreshToken(clientId, clientSecret, user.strava_refresh_token);

	await supabaseAdmin
		.from('rt_users')
		.update({
			strava_access_token: data.access_token,
			strava_refresh_token: data.refresh_token,
			strava_token_expires_at: new Date(data.expires_at * 1000).toISOString()
		})
		.eq('id', user.id);

	return data.access_token;
}

export async function fetchActivity(accessToken, activityId) {
	const res = await fetch(`${STRAVA_API}/activities/${activityId}`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw new Error(`Strava fetch activity failed: ${res.status}`);
	return res.json();
}

export async function fetchActivitiesPage(accessToken, page = 1, perPage = 100) {
	const params = new URLSearchParams({
		page: String(page),
		per_page: String(perPage)
	});
	const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw new Error(`Strava fetch activities failed: ${res.status}`);
	return res.json();
}

export function mapStravaActivity(stravaActivity, userId) {
	return {
		user_id: userId,
		strava_id: stravaActivity.id,
		sport_type: stravaActivity.type || stravaActivity.sport_type || 'Unknown',
		name: stravaActivity.name,
		description: stravaActivity.description || null,
		activity_date: stravaActivity.start_date,
		elapsed_time_s: stravaActivity.elapsed_time,
		moving_time_s: stravaActivity.moving_time,
		distance_m: stravaActivity.distance,
		avg_hr: stravaActivity.average_heartrate || null,
		max_hr: stravaActivity.max_heartrate || null,
		calories: stravaActivity.calories || null,
		avg_speed_ms: stravaActivity.average_speed || null,
		max_speed_ms: stravaActivity.max_speed || null,
		avg_watts: stravaActivity.average_watts || null,
		weighted_avg_power: stravaActivity.weighted_average_watts || null,
		avg_cadence: stravaActivity.average_cadence || null,
		max_cadence: stravaActivity.max_cadence || null,
		training_load: stravaActivity.suffer_score || null,
		elevation_gain: stravaActivity.total_elevation_gain || null,
		elevation_low: stravaActivity.elev_low || null,
		elevation_high: stravaActivity.elev_high || null,
		summary_polyline: stravaActivity.map?.summary_polyline || null,
		gear_name: stravaActivity.gear?.name || stravaActivity.gear_id || null,
		raw_json: stravaActivity
	};
}
