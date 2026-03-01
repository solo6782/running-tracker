/**
 * Withings API helper
 * Handles OAuth2 with signature (HMAC-SHA256 + nonce)
 */

const API_ENDPOINT = 'https://wbsapi.withings.net';

/**
 * HMAC-SHA256 sign a string with a secret
 */
async function hmacSign(message, secret) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw', encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false, ['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
	return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get a nonce from Withings API
 */
export async function getNonce(clientId, clientSecret) {
	const timestamp = Math.floor(Date.now() / 1000);
	const signData = `getnonce,${clientId},${timestamp}`;
	const signature = await hmacSign(signData, clientSecret);

	const params = new URLSearchParams({
		action: 'getnonce',
		client_id: clientId,
		timestamp: String(timestamp),
		signature: signature
	});

	const res = await fetch(`${API_ENDPOINT}/v2/signature`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params.toString()
	});

	const data = await res.json();
	if (data.status !== 0) {
		throw new Error(`Withings getnonce error: ${data.status} ${JSON.stringify(data)}`);
	}
	return data.body.nonce;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code, redirectUri, clientId, clientSecret) {
	const nonce = await getNonce(clientId, clientSecret);

	const signData = `requesttoken,${clientId},${nonce}`;
	const signature = await hmacSign(signData, clientSecret);

	const params = new URLSearchParams({
		action: 'requesttoken',
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'authorization_code',
		code: code,
		redirect_uri: redirectUri,
		nonce: nonce,
		signature: signature
	});

	const res = await fetch(`${API_ENDPOINT}/v2/oauth2`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params.toString()
	});

	const data = await res.json();
	if (data.status !== 0) {
		throw new Error(`Withings token error: ${data.status} ${JSON.stringify(data)}`);
	}

	return {
		access_token: data.body.access_token,
		refresh_token: data.body.refresh_token,
		userid: data.body.userid,
		expires_in: data.body.expires_in,
		scope: data.body.scope
	};
}

/**
 * Refresh access token
 */
export async function refreshTokens(refreshToken, clientId, clientSecret) {
	const nonce = await getNonce(clientId, clientSecret);

	const signData = `requesttoken,${clientId},${nonce}`;
	const signature = await hmacSign(signData, clientSecret);

	const params = new URLSearchParams({
		action: 'requesttoken',
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		nonce: nonce,
		signature: signature
	});

	const res = await fetch(`${API_ENDPOINT}/v2/oauth2`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: params.toString()
	});

	const data = await res.json();
	if (data.status !== 0) {
		throw new Error(`Withings refresh error: ${data.status} ${JSON.stringify(data)}`);
	}

	return {
		access_token: data.body.access_token,
		refresh_token: data.body.refresh_token,
		expires_in: data.body.expires_in
	};
}

/**
 * Get body measurements
 * meastype: 1=weight, 4=height, 5=fat free mass, 6=fat ratio, 8=fat mass, 
 *           76=muscle mass, 77=hydration, 88=bone mass, 11=heart pulse
 */
export async function getMeasures(accessToken, opts = {}) {
	const params = new URLSearchParams({
		action: 'getmeas',
		...(opts.meastype ? { meastype: String(opts.meastype) } : {}),
		...(opts.category ? { category: String(opts.category) } : { category: '1' }), // 1 = real measures only
		...(opts.startdate ? { startdate: String(opts.startdate) } : {}),
		...(opts.enddate ? { enddate: String(opts.enddate) } : {}),
		...(opts.lastupdate ? { lastupdate: String(opts.lastupdate) } : {})
	});

	const res = await fetch(`${API_ENDPOINT}/measure`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Authorization': `Bearer ${accessToken}`
		},
		body: params.toString()
	});

	const data = await res.json();
	if (data.status !== 0) {
		throw new Error(`Withings measure error: ${data.status}`);
	}

	return data.body;
}

/**
 * Parse measurement value from Withings format (value * 10^unit)
 */
export function parseMeasureValue(measure) {
	return measure.value * Math.pow(10, measure.unit);
}

/**
 * Measure type IDs
 */
export const MEASURE_TYPES = {
	WEIGHT: 1,
	HEIGHT: 4,
	FAT_FREE_MASS: 5,
	FAT_RATIO: 6,
	FAT_MASS: 8,
	HEART_PULSE: 11,
	MUSCLE_MASS: 76,
	HYDRATION: 77,
	BONE_MASS: 88
};
