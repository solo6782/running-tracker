import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function GET({ platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	try {
		const { data, error } = await supabaseAdmin
			.from('rt_activities')
			.select('sport_type')
			.order('sport_type');

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		// Dédupliquer et compter
		const counts = {};
		for (const row of data) {
			counts[row.sport_type] = (counts[row.sport_type] || 0) + 1;
		}

		const sportTypes = Object.entries(counts)
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count);

		return json({ success: true, sportTypes });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
