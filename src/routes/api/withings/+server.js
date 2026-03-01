import { json } from '@sveltejs/kit';
import { getEnv } from '$lib/env.js';
import { createServerClient } from '$lib/supabase.js';
import { refreshTokens, getMeasures, parseMeasureValue, MEASURE_TYPES } from '$lib/withings.js';

export async function GET({ platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	// 1. Get stored tokens
	const { data: tokenRow, error: tokErr } = await supabase
		.from('rt_withings_tokens')
		.select('*')
		.limit(1)
		.single();

	if (tokErr || !tokenRow) {
		return json({ connected: false, error: 'Withings non connecté' });
	}

	// 2. Refresh token if expired
	let accessToken = tokenRow.access_token;
	const expiresAt = new Date(tokenRow.expires_at);
	if (expiresAt < new Date()) {
		try {
			const newTokens = await refreshTokens(
				tokenRow.refresh_token,
				env.WITHINGS_CLIENT_ID,
				env.WITHINGS_CLIENT_SECRET
			);
			accessToken = newTokens.access_token;

			// Update stored tokens
			await supabase.from('rt_withings_tokens')
				.update({
					access_token: newTokens.access_token,
					refresh_token: newTokens.refresh_token,
					expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
				})
				.eq('id', tokenRow.id);
		} catch (err) {
			console.error('Withings refresh failed:', err);
			return json({ connected: false, error: 'Token expiré, reconnecte Withings' });
		}
	}

	// 3. Fetch measurements (last 6 months)
	try {
		const sixMonthsAgo = Math.floor((Date.now() - 180 * 24 * 3600 * 1000) / 1000);
		const body = await getMeasures(accessToken, { startdate: sixMonthsAgo });

		// 4. Parse measurements
		const measurements = {
			weight: [],
			fat_ratio: [],
			muscle_mass: [],
			bone_mass: [],
			hydration: [],
			fat_mass: [],
			heart_pulse: []
		};

		const typeMap = {
			[MEASURE_TYPES.WEIGHT]: 'weight',
			[MEASURE_TYPES.FAT_RATIO]: 'fat_ratio',
			[MEASURE_TYPES.MUSCLE_MASS]: 'muscle_mass',
			[MEASURE_TYPES.BONE_MASS]: 'bone_mass',
			[MEASURE_TYPES.HYDRATION]: 'hydration',
			[MEASURE_TYPES.FAT_MASS]: 'fat_mass',
			[MEASURE_TYPES.HEART_PULSE]: 'heart_pulse'
		};

		for (const grp of body.measuregrps || []) {
			const date = new Date(grp.date * 1000).toISOString().split('T')[0];
			for (const m of grp.measures || []) {
				const key = typeMap[m.type];
				if (key) {
					measurements[key].push({
						date,
						value: Math.round(parseMeasureValue(m) * 100) / 100
					});
				}
			}
		}

		// Sort each array by date desc
		for (const key of Object.keys(measurements)) {
			measurements[key].sort((a, b) => b.date.localeCompare(a.date));
		}

		// Latest values summary
		const latest = {};
		for (const [key, arr] of Object.entries(measurements)) {
			if (arr.length > 0) latest[key] = arr[0];
		}

		return json({
			connected: true,
			latest,
			measurements,
			count: body.measuregrps?.length || 0
		});
	} catch (err) {
		console.error('Withings fetch error:', err);
		return json({ connected: false, error: err.message });
	}
}
