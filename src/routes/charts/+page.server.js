import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function load({ url, platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	// Optional sport filter
	const sportFilter = url.searchParams.get('sport') || 'all';

	try {
		let query = supabaseAdmin
			.from('rt_activities')
			.select('sport_type, distance_m, moving_time_s, avg_speed_ms, avg_hr, elevation_gain, calories, activity_date, perceived_difficulty, perceived_feeling, training_load')
			.order('activity_date', { ascending: true });

		const { data: allActivities, error } = await query;

		if (error || !allActivities || allActivities.length === 0) {
			return { error: error?.message || null, empty: true, sportTypes: [], sportFilter };
		}

		// Sport types for filter
		const sportCounts = {};
		for (const a of allActivities) {
			sportCounts[a.sport_type] = (sportCounts[a.sport_type] || 0) + 1;
		}
		const sportTypes = Object.entries(sportCounts)
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count);

		// Filter activities if sport selected
		const activities = sportFilter !== 'all'
			? allActivities.filter(a => a.sport_type === sportFilter)
			: allActivities;

		if (activities.length === 0) {
			return { error: null, empty: true, sportTypes, sportFilter };
		}

		// ===== MONTHLY AGGREGATES =====
		const monthlyMap = {};
		for (const a of activities) {
			const month = a.activity_date.substring(0, 7); // YYYY-MM
			if (!monthlyMap[month]) {
				monthlyMap[month] = { distance: 0, time: 0, count: 0, elevation: 0, calories: 0, hrSum: 0, hrCount: 0, paceSum: 0, paceCount: 0 };
			}
			const m = monthlyMap[month];
			m.distance += a.distance_m || 0;
			m.time += a.moving_time_s || 0;
			m.count++;
			m.elevation += a.elevation_gain || 0;
			m.calories += a.calories || 0;
			if (a.avg_hr) { m.hrSum += a.avg_hr; m.hrCount++; }
			if (a.avg_speed_ms && a.avg_speed_ms > 0) { m.paceSum += 1000 / a.avg_speed_ms; m.paceCount++; }
		}

		const monthly = Object.entries(monthlyMap)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([month, m]) => ({
				month,
				label: formatMonthLabel(month),
				distance: m.distance,
				time: m.time,
				count: m.count,
				elevation: m.elevation,
				calories: m.calories,
				avgHr: m.hrCount > 0 ? m.hrSum / m.hrCount : null,
				avgPace: m.paceCount > 0 ? m.paceSum / m.paceCount : null // seconds per km
			}));

		// ===== WEEKLY AGGREGATES =====
		const weeklyMap = {};
		for (const a of activities) {
			const d = new Date(a.activity_date);
			const weekStart = getWeekStart(d);
			const key = weekStart.toISOString().split('T')[0];
			if (!weeklyMap[key]) {
				weeklyMap[key] = { distance: 0, time: 0, count: 0, elevation: 0 };
			}
			weeklyMap[key].distance += a.distance_m || 0;
			weeklyMap[key].time += a.moving_time_s || 0;
			weeklyMap[key].count++;
			weeklyMap[key].elevation += a.elevation_gain || 0;
		}

		const weekly = Object.entries(weeklyMap)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([week, w]) => ({ week, ...w }));

		// ===== PER-ACTIVITY DATA (for scatter/trend) =====
		// Limit to last 100 for performance
		const recentActivities = activities.slice(-150).map(a => ({
			date: a.activity_date.split('T')[0],
			distance: a.distance_m,
			pace: a.avg_speed_ms && a.avg_speed_ms > 0 ? 1000 / a.avg_speed_ms : null, // sec/km
			hr: a.avg_hr,
			elevation: a.elevation_gain,
			rpe: a.perceived_difficulty,
			feeling: a.perceived_feeling,
			sport: a.sport_type
		}));

		// ===== SPORT DISTRIBUTION =====
		const sportDist = {};
		for (const a of allActivities) {
			if (!sportDist[a.sport_type]) sportDist[a.sport_type] = { count: 0, distance: 0 };
			sportDist[a.sport_type].count++;
			sportDist[a.sport_type].distance += a.distance_m || 0;
		}
		const sportDistribution = Object.entries(sportDist)
			.map(([type, s]) => ({ type, count: s.count, distance: s.distance }))
			.sort((a, b) => b.count - a.count);

		// ===== HR ZONE DISTRIBUTION =====
		const hrZones = [0, 0, 0, 0, 0]; // Z1(<120), Z2(120-140), Z3(140-160), Z4(160-180), Z5(>180)
		for (const a of activities) {
			if (!a.avg_hr) continue;
			if (a.avg_hr < 120) hrZones[0]++;
			else if (a.avg_hr < 140) hrZones[1]++;
			else if (a.avg_hr < 160) hrZones[2]++;
			else if (a.avg_hr < 180) hrZones[3]++;
			else hrZones[4]++;
		}

		return {
			error: null,
			empty: false,
			monthly,
			weekly,
			recentActivities,
			sportDistribution,
			hrZones,
			sportTypes,
			sportFilter,
			totalActivities: activities.length
		};
	} catch (err) {
		return { error: err.message, empty: true, sportTypes: [], sportFilter };
	}
}

function getWeekStart(date) {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	d.setDate(diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

function formatMonthLabel(monthStr) {
	const [year, month] = monthStr.split('-');
	const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
	return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}
