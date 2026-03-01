import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

// GET - Récupère le programme actif
export async function GET({ platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const { data, error } = await supabase
		.from('rt_programmes')
		.select('*')
		.eq('is_active', true)
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
		return json({ error: error.message }, { status: 500 });
	}

	return json({ programme: data || null });
}

// POST - Crée un nouveau programme (désactive les anciens)
export async function POST({ request, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const body = await request.json();

	// Valider les champs requis
	if (!body.race_name || !body.race_date || !body.race_distance_km) {
		return json({ error: 'Champs requis manquants' }, { status: 400 });
	}

	// Désactiver les anciens programmes
	await supabase
		.from('rt_programmes')
		.update({ is_active: false })
		.eq('is_active', true);

	// Créer le nouveau
	const { data, error } = await supabase
		.from('rt_programmes')
		.insert({
			race_name: body.race_name,
			race_date: body.race_date,
			race_distance_km: body.race_distance_km,
			race_location: body.race_location || null,
			race_elevation_gain: body.race_elevation_gain || null,
			race_profile: body.race_profile || null,
			race_url: body.race_url || null,
			race_description: body.race_description || null,
			objective_type: body.objective_type || 'finish',
			objective_time: body.objective_time || null,
			availability: body.availability || {},
			is_active: true
		})
		.select()
		.single();

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ programme: data });
}

// PATCH - Met à jour le programme actif (availability, objectif, etc.)
export async function PATCH({ request, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const body = await request.json();

	if (!body.id) {
		return json({ error: 'ID requis' }, { status: 400 });
	}

	const updateData = { updated_at: new Date().toISOString() };

	// Only update provided fields
	if (body.availability !== undefined) updateData.availability = body.availability;
	if (body.objective_type !== undefined) updateData.objective_type = body.objective_type;
	if (body.objective_time !== undefined) updateData.objective_time = body.objective_time;
	if (body.race_name !== undefined) updateData.race_name = body.race_name;
	if (body.race_date !== undefined) updateData.race_date = body.race_date;
	if (body.race_distance_km !== undefined) updateData.race_distance_km = body.race_distance_km;
	if (body.race_location !== undefined) updateData.race_location = body.race_location;
	if (body.race_elevation_gain !== undefined) updateData.race_elevation_gain = body.race_elevation_gain;
	if (body.race_profile !== undefined) updateData.race_profile = body.race_profile;
	if (body.race_url !== undefined) updateData.race_url = body.race_url;
	if (body.is_active !== undefined) updateData.is_active = body.is_active;

	const { data, error } = await supabase
		.from('rt_programmes')
		.update(updateData)
		.eq('id', body.id)
		.select()
		.single();

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ programme: data });
}

// DELETE - Supprime (désactive) un programme
export async function DELETE({ url, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const id = url.searchParams.get('id');
	if (!id) {
		return json({ error: 'ID requis' }, { status: 400 });
	}

	const { error } = await supabase
		.from('rt_programmes')
		.update({ is_active: false })
		.eq('id', id);

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json({ success: true });
}
