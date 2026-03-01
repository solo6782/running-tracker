import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function GET({ params, platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	try {
		const { data, error } = await supabaseAdmin
			.from('rt_activities')
			.select('*')
			.eq('id', params.id)
			.single();

		if (error || !data) {
			return json({ success: false, error: 'Activity not found' }, { status: 404 });
		}

		// Exclure raw_json de la réponse (trop volumineux)
		const { raw_json, ...activity } = data;

		return json({ success: true, activity });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}

export async function PATCH({ params, request, platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	try {
		const body = await request.json();
		const updates = {};

		// Valider RPE (1-10)
		if (body.perceived_difficulty !== undefined) {
			const rpe = body.perceived_difficulty;
			if (rpe !== null && (rpe < 1 || rpe > 10 || !Number.isInteger(rpe))) {
				return json({ success: false, error: 'RPE must be an integer between 1 and 10' }, { status: 400 });
			}
			updates.perceived_difficulty = rpe;
		}

		// Valider feeling (1-7)
		if (body.perceived_feeling !== undefined) {
			const feeling = body.perceived_feeling;
			if (feeling !== null && (feeling < 1 || feeling > 7 || !Number.isInteger(feeling))) {
				return json({ success: false, error: 'Feeling must be an integer between 1 and 7' }, { status: 400 });
			}
			updates.perceived_feeling = feeling;
		}

		if (Object.keys(updates).length === 0) {
			return json({ success: false, error: 'No valid fields to update' }, { status: 400 });
		}

		const { data, error } = await supabaseAdmin
			.from('rt_activities')
			.update(updates)
			.eq('id', params.id)
			.select('id, perceived_difficulty, perceived_feeling')
			.single();

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({ success: true, activity: data });
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
