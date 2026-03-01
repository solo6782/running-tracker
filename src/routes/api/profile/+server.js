import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function GET({ platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const { data, error } = await supabase
		.from('rt_athlete_profile')
		.select('*')
		.limit(1)
		.single();

	if (error && error.code !== 'PGRST116') {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ profile: data || null });
}

export async function POST({ request, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const body = await request.json();

	// Upsert: delete existing then insert
	await supabase.from('rt_athlete_profile').delete().neq('id', '00000000-0000-0000-0000-000000000000');

	const { data, error } = await supabase
		.from('rt_athlete_profile')
		.insert({
			date_of_birth: body.date_of_birth || null,
			weight_kg: body.weight_kg || null,
			height_cm: body.height_cm || null,
			resting_hr: body.resting_hr || null,
			max_hr: body.max_hr || null,
			notes: body.notes || null
		})
		.select()
		.single();

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ profile: data });
}
