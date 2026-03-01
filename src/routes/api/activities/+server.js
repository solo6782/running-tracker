import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function GET({ url, platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	// Pagination
	const page = parseInt(url.searchParams.get('page') || '1');
	const perPage = parseInt(url.searchParams.get('per_page') || '30');
	const offset = (page - 1) * perPage;

	// Filtres
	const sportType = url.searchParams.get('sport_type');
	const dateFrom = url.searchParams.get('date_from');
	const dateTo = url.searchParams.get('date_to');
	const distanceMin = url.searchParams.get('distance_min');
	const distanceMax = url.searchParams.get('distance_max');
	const sortBy = url.searchParams.get('sort_by') || 'activity_date';
	const sortDir = url.searchParams.get('sort_dir') || 'desc';
	const search = url.searchParams.get('search');

	try {
		let query = supabaseAdmin
			.from('rt_activities')
			.select(
				'id, strava_id, sport_type, name, activity_date, distance_m, moving_time_s, elapsed_time_s, avg_speed_ms, avg_hr, max_hr, elevation_gain, calories, perceived_difficulty, perceived_feeling, gear_name, training_load',
				{ count: 'exact' }
			);

		// Appliquer les filtres
		if (sportType && sportType !== 'all') {
			query = query.eq('sport_type', sportType);
		}
		if (dateFrom) {
			query = query.gte('activity_date', dateFrom);
		}
		if (dateTo) {
			query = query.lte('activity_date', dateTo + 'T23:59:59Z');
		}
		if (distanceMin) {
			query = query.gte('distance_m', parseFloat(distanceMin) * 1000);
		}
		if (distanceMax) {
			query = query.lte('distance_m', parseFloat(distanceMax) * 1000);
		}
		if (search) {
			query = query.ilike('name', `%${search}%`);
		}

		// Tri
		const validSortFields = ['activity_date', 'distance_m', 'moving_time_s', 'avg_speed_ms', 'avg_hr', 'elevation_gain'];
		const field = validSortFields.includes(sortBy) ? sortBy : 'activity_date';
		const ascending = sortDir === 'asc';
		query = query.order(field, { ascending });

		// Pagination
		query = query.range(offset, offset + perPage - 1);

		const { data, count, error } = await query;

		if (error) {
			return json({ success: false, error: error.message }, { status: 500 });
		}

		return json({
			success: true,
			activities: data,
			total: count,
			page,
			perPage,
			totalPages: Math.ceil((count || 0) / perPage)
		});
	} catch (err) {
		return json({ success: false, error: err.message }, { status: 500 });
	}
}
