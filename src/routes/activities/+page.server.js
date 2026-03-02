import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function load({ url, platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const page = parseInt(url.searchParams.get('page') || '1');
	const perPage = 30;
	const offset = (page - 1) * perPage;

	const sportType = url.searchParams.get('sport') || 'all';
	const dateFrom = url.searchParams.get('from') || '';
	const dateTo = url.searchParams.get('to') || '';
	const search = url.searchParams.get('q') || '';
	const sortBy = url.searchParams.get('sort') || 'activity_date';
	const sortDir = url.searchParams.get('dir') || 'desc';

	try {
		// Requête activités
		let query = supabaseAdmin
			.from('rt_activities')
			.select(
				'id, strava_id, sport_type, name, activity_date, distance_m, moving_time_s, elapsed_time_s, avg_speed_ms, avg_hr, max_hr, elevation_gain, calories, perceived_difficulty, perceived_feeling, gear_name, training_load',
				{ count: 'exact' }
			);

		if (sportType !== 'all') query = query.eq('sport_type', sportType);
		if (dateFrom) query = query.gte('activity_date', dateFrom);
		if (dateTo) query = query.lte('activity_date', dateTo + 'T23:59:59Z');
		if (search) query = query.ilike('name', `%${search}%`);

		const validSorts = ['activity_date', 'distance_m', 'moving_time_s', 'avg_speed_ms', 'avg_hr', 'elevation_gain'];
		const field = validSorts.includes(sortBy) ? sortBy : 'activity_date';
		query = query.order(field, { ascending: sortDir === 'asc' });
		query = query.range(offset, offset + perPage - 1);

		const { data: activities, count, error } = await query;

		if (error) {
			return { activities: [], total: 0, page, totalPages: 0, filters: {}, sportTypes: [], plannedDates: {}, error: error.message };
		}

		// Get planned dates from active programmes
		const plannedDates = {};
		const { data: programmes } = await supabaseAdmin
			.from('rt_programmes')
			.select('race_name, availability')
			.eq('active', true);

		for (const prog of (programmes || [])) {
			const avail = prog.availability || {};
			for (const [date, val] of Object.entries(avail)) {
				if (val?.plan) plannedDates[date] = { type: val.plan.type, title: val.plan.title, race: prog.race_name };
			}
		}

		// Sport types pour le filtre
		const { data: allSports } = await supabaseAdmin
			.from('rt_activities')
			.select('sport_type');

		const sportCounts = {};
		for (const row of (allSports || [])) {
			sportCounts[row.sport_type] = (sportCounts[row.sport_type] || 0) + 1;
		}
		const sportTypes = Object.entries(sportCounts)
			.map(([type, cnt]) => ({ type, count: cnt }))
			.sort((a, b) => b.count - a.count);

		return {
			activities: activities || [],
			total: count || 0,
			page,
			totalPages: Math.ceil((count || 0) / perPage),
			filters: { sportType, dateFrom, dateTo, search, sortBy, sortDir },
			sportTypes,
			plannedDates,
			error: null
		};
	} catch (err) {
		return { activities: [], total: 0, page: 1, totalPages: 0, filters: {}, sportTypes: [], plannedDates: {}, error: err.message };
	}
}
