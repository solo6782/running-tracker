import { json } from '@sveltejs/kit';
import { getEnv } from '$lib/env.js';
import { createServerClient } from '$lib/supabase.js';
import { refreshTokens, getMeasures, parseMeasureValue, MEASURE_TYPES } from '$lib/withings.js';

/**
 * GET /api/withings — returns cached data from Supabase
 * GET /api/withings?sync=1 — fetches from Withings API, upserts to DB, then returns
 */
export async function GET({ url, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
	const doSync = url.searchParams.get('sync') === '1';

	// Check if connected
	const { data: tokenRow } = await supabase
		.from('rt_withings_tokens')
		.select('*')
		.limit(1)
		.single();

	if (!tokenRow) {
		return json({ connected: false, error: 'Withings non connecté' });
	}

	// Sync from Withings API if requested
	if (doSync) {
		try {
			await syncFromWithings(tokenRow, env, supabase);
		} catch (err) {
			console.error('Withings sync error:', err);
			return json({ connected: true, error: `Sync échouée: ${err.message}`, synced: false });
		}
	}

	// Read from DB
	const { data: measures } = await supabase
		.from('rt_withings_measures')
		.select('*')
		.order('measure_date', { ascending: false })
		.limit(200);

	if (!measures || measures.length === 0) {
		// No data yet — auto-sync on first visit
		if (!doSync) {
			try {
				await syncFromWithings(tokenRow, env, supabase);
				const { data: freshMeasures } = await supabase
					.from('rt_withings_measures')
					.select('*')
					.order('measure_date', { ascending: false })
					.limit(200);
				return json({
					connected: true,
					latest: buildLatest(freshMeasures || []),
					measurements: buildMeasurements(freshMeasures || []),
					count: freshMeasures?.length || 0,
					synced: true
				});
			} catch (err) {
				console.error('Auto-sync error:', err);
				return json({ connected: true, latest: {}, measurements: {}, count: 0 });
			}
		}
		return json({ connected: true, latest: {}, measurements: {}, count: 0 });
	}

	return json({
		connected: true,
		latest: buildLatest(measures),
		measurements: buildMeasurements(measures),
		count: measures.length,
		synced: doSync
	});
}

/**
 * Fetch from Withings API and upsert into rt_withings_measures
 */
async function syncFromWithings(tokenRow, env, supabase) {
	let accessToken = tokenRow.access_token;

	// Refresh if expired
	if (new Date(tokenRow.expires_at) < new Date()) {
		const newTokens = await refreshTokens(
			tokenRow.refresh_token,
			env.WITHINGS_CLIENT_ID,
			env.WITHINGS_CLIENT_SECRET
		);
		accessToken = newTokens.access_token;
		await supabase.from('rt_withings_tokens')
			.update({
				access_token: newTokens.access_token,
				refresh_token: newTokens.refresh_token,
				expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
			})
			.eq('id', tokenRow.id);
	}

	// Fetch last 6 months
	const sixMonthsAgo = Math.floor((Date.now() - 180 * 24 * 3600 * 1000) / 1000);
	const body = await getMeasures(accessToken, { startdate: sixMonthsAgo });

	// Group measures by date
	const byDate = {};
	const typeMap = {
		[MEASURE_TYPES.WEIGHT]: 'weight_kg',
		[MEASURE_TYPES.FAT_RATIO]: 'fat_ratio_pct',
		[MEASURE_TYPES.FAT_MASS]: 'fat_mass_kg',
		5: 'fat_free_mass_kg',
		[MEASURE_TYPES.MUSCLE_MASS]: 'muscle_mass_kg',
		[MEASURE_TYPES.BONE_MASS]: 'bone_mass_kg',
		[MEASURE_TYPES.HYDRATION]: 'hydration_kg'
	};

	for (const grp of body.measuregrps || []) {
		const date = new Date(grp.date * 1000).toISOString().split('T')[0];
		if (!byDate[date]) byDate[date] = { measure_date: date };

		for (const m of grp.measures || []) {
			const col = typeMap[m.type];
			if (col) {
				byDate[date][col] = Math.round(parseMeasureValue(m) * 100) / 100;
			}
		}
	}

	// Upsert to Supabase in chunks
	const rows = Object.values(byDate);
	for (let i = 0; i < rows.length; i += 50) {
		const chunk = rows.slice(i, i + 50);
		await supabase
			.from('rt_withings_measures')
			.upsert(chunk, { onConflict: 'measure_date' });
	}
}

/** Build latest values from DB rows (sorted desc) */
function buildLatest(rows) {
	const latest = {};
	const fields = {
		weight_kg: 'weight', fat_ratio_pct: 'fat_ratio', fat_mass_kg: 'fat_mass',
		fat_free_mass_kg: 'fat_free_mass', muscle_mass_kg: 'muscle_mass',
		bone_mass_kg: 'bone_mass', hydration_kg: 'hydration'
	};
	for (const [col, key] of Object.entries(fields)) {
		for (const row of rows) {
			if (row[col] != null) {
				latest[key] = { date: row.measure_date, value: Number(row[col]) };
				break;
			}
		}
	}
	return latest;
}

/** Build measurement arrays from DB rows */
function buildMeasurements(rows) {
	const measurements = {
		weight: [], fat_ratio: [], muscle_mass: [],
		bone_mass: [], hydration: [], fat_mass: [], fat_free_mass: []
	};
	const mapping = {
		weight_kg: 'weight', fat_ratio_pct: 'fat_ratio', fat_mass_kg: 'fat_mass',
		fat_free_mass_kg: 'fat_free_mass', muscle_mass_kg: 'muscle_mass',
		bone_mass_kg: 'bone_mass', hydration_kg: 'hydration'
	};
	for (const row of rows) {
		for (const [col, key] of Object.entries(mapping)) {
			if (row[col] != null) {
				measurements[key].push({ date: row.measure_date, value: Number(row[col]) });
			}
		}
	}
	return measurements;
}
