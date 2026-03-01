import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';

export async function load({ platform }) {
	const env = getEnv(platform);
	const supabaseAdmin = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const now = new Date();
	const today = now.toISOString().split('T')[0];

	// Helpers for date ranges
	function startOfWeek(date) {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
		d.setDate(diff);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function startOfMonth(date) {
		const d = new Date(date);
		d.setDate(1);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function startOfYear(date) {
		return new Date(date.getFullYear(), 0, 1);
	}

	const thisWeekStart = startOfWeek(now);
	const lastWeekStart = new Date(thisWeekStart);
	lastWeekStart.setDate(lastWeekStart.getDate() - 7);

	const thisMonthStart = startOfMonth(now);
	const lastMonthStart = new Date(thisMonthStart);
	lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

	const thisYearStart = startOfYear(now);

	try {
		// ===== ALL-TIME STATS =====
		const { data: allActivities } = await supabaseAdmin
			.from('rt_activities')
			.select('id, sport_type, distance_m, moving_time_s, elevation_gain, calories, avg_hr, avg_speed_ms, activity_date, perceived_difficulty, perceived_feeling, name');

		if (!allActivities || allActivities.length === 0) {
			return { error: null, empty: true };
		}

		const totalActivities = allActivities.length;
		const totalDistance = allActivities.reduce((s, a) => s + (a.distance_m || 0), 0);
		const totalTime = allActivities.reduce((s, a) => s + (a.moving_time_s || 0), 0);
		const totalElevation = allActivities.reduce((s, a) => s + (a.elevation_gain || 0), 0);
		const totalCalories = allActivities.reduce((s, a) => s + (a.calories || 0), 0);

		// ===== SPORT DISTRIBUTION =====
		const sportMap = {};
		for (const a of allActivities) {
			if (!sportMap[a.sport_type]) {
				sportMap[a.sport_type] = { count: 0, distance: 0, time: 0, elevation: 0 };
			}
			sportMap[a.sport_type].count++;
			sportMap[a.sport_type].distance += a.distance_m || 0;
			sportMap[a.sport_type].time += a.moving_time_s || 0;
			sportMap[a.sport_type].elevation += a.elevation_gain || 0;
		}
		const sportDistribution = Object.entries(sportMap)
			.map(([type, stats]) => ({ type, ...stats }))
			.sort((a, b) => b.count - a.count);

		// ===== PERIOD STATS =====
		function periodStats(activities) {
			return {
				count: activities.length,
				distance: activities.reduce((s, a) => s + (a.distance_m || 0), 0),
				time: activities.reduce((s, a) => s + (a.moving_time_s || 0), 0),
				elevation: activities.reduce((s, a) => s + (a.elevation_gain || 0), 0),
				calories: activities.reduce((s, a) => s + (a.calories || 0), 0)
			};
		}

		const thisWeekActivities = allActivities.filter(a => new Date(a.activity_date) >= thisWeekStart);
		const lastWeekActivities = allActivities.filter(a => {
			const d = new Date(a.activity_date);
			return d >= lastWeekStart && d < thisWeekStart;
		});
		const thisMonthActivities = allActivities.filter(a => new Date(a.activity_date) >= thisMonthStart);
		const lastMonthActivities = allActivities.filter(a => {
			const d = new Date(a.activity_date);
			return d >= lastMonthStart && d < thisMonthStart;
		});
		const thisYearActivities = allActivities.filter(a => new Date(a.activity_date) >= thisYearStart);

		const thisWeek = periodStats(thisWeekActivities);
		const lastWeek = periodStats(lastWeekActivities);
		const thisMonth = periodStats(thisMonthActivities);
		const lastMonth = periodStats(lastMonthActivities);
		const thisYear = periodStats(thisYearActivities);

		// ===== PERSONAL BESTS (Running only) =====
		const runs = allActivities.filter(a => a.sport_type === 'Run');

		let longestRun = null;
		let fastestPace = null;
		let longestDuration = null;
		let highestElevation = null;

		if (runs.length > 0) {
			// Longest distance
			const byDist = [...runs].sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));
			if (byDist[0]?.distance_m) {
				longestRun = { value: byDist[0].distance_m, name: byDist[0].name, date: byDist[0].activity_date };
			}

			// Fastest pace (highest avg_speed on runs > 3km)
			const longRuns = runs.filter(a => (a.distance_m || 0) > 3000 && a.avg_speed_ms);
			if (longRuns.length > 0) {
				const bySpeed = [...longRuns].sort((a, b) => (b.avg_speed_ms || 0) - (a.avg_speed_ms || 0));
				fastestPace = { value: bySpeed[0].avg_speed_ms, name: bySpeed[0].name, date: bySpeed[0].activity_date, distance: bySpeed[0].distance_m };
			}

			// Longest duration
			const byTime = [...runs].sort((a, b) => (b.moving_time_s || 0) - (a.moving_time_s || 0));
			if (byTime[0]?.moving_time_s) {
				longestDuration = { value: byTime[0].moving_time_s, name: byTime[0].name, date: byTime[0].activity_date };
			}

			// Most elevation
			const byElev = [...runs].sort((a, b) => (b.elevation_gain || 0) - (a.elevation_gain || 0));
			if (byElev[0]?.elevation_gain) {
				highestElevation = { value: byElev[0].elevation_gain, name: byElev[0].name, date: byElev[0].activity_date };
			}
		}

		// ===== RECENT ACTIVITIES (last 5) =====
		const recent = [...allActivities]
			.sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date))
			.slice(0, 5);

		// ===== WEEKLY VOLUME (last 8 weeks) =====
		const weeklyVolume = [];
		for (let i = 7; i >= 0; i--) {
			const weekStart = new Date(thisWeekStart);
			weekStart.setDate(weekStart.getDate() - i * 7);
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekEnd.getDate() + 7);

			const weekActivities = allActivities.filter(a => {
				const d = new Date(a.activity_date);
				return d >= weekStart && d < weekEnd;
			});

			weeklyVolume.push({
				weekStart: weekStart.toISOString().split('T')[0],
				distance: weekActivities.reduce((s, a) => s + (a.distance_m || 0), 0),
				time: weekActivities.reduce((s, a) => s + (a.moving_time_s || 0), 0),
				count: weekActivities.length
			});
		}

		// ===== RPE/FEELING STATS =====
		const withRpe = allActivities.filter(a => a.perceived_difficulty != null);
		const withFeeling = allActivities.filter(a => a.perceived_feeling != null);
		const avgRpe = withRpe.length > 0 ? withRpe.reduce((s, a) => s + a.perceived_difficulty, 0) / withRpe.length : null;
		const avgFeeling = withFeeling.length > 0 ? withFeeling.reduce((s, a) => s + a.perceived_feeling, 0) / withFeeling.length : null;
		const rpeCount = withRpe.length;
		const feelingCount = withFeeling.length;

		return {
			error: null,
			empty: false,
			allTime: { totalActivities, totalDistance, totalTime, totalElevation, totalCalories },
			sportDistribution,
			thisWeek,
			lastWeek,
			thisMonth,
			lastMonth,
			thisYear,
			records: { longestRun, fastestPace, longestDuration, highestElevation },
			recent,
			weeklyVolume,
			perception: { avgRpe, avgFeeling, rpeCount, feelingCount },
			runCount: runs.length
		};
	} catch (err) {
		return { error: err.message, empty: true };
	}
}
