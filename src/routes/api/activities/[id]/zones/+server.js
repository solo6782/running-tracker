import { json } from '@sveltejs/kit';
import { createServerClient } from '$lib/supabase.js';
import { getEnv } from '$lib/env.js';
import { getValidToken } from '$lib/strava.js';

function defaultZones(maxHR) {
	return [
		{ zone: 1, label: 'Récupération', min: 0, max: Math.round(maxHR * 0.6) },
		{ zone: 2, label: 'Endurance', min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7) },
		{ zone: 3, label: 'Tempo', min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.8) },
		{ zone: 4, label: 'Seuil', min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9) },
		{ zone: 5, label: 'VO2max', min: Math.round(maxHR * 0.9), max: maxHR }
	];
}

function computeZonesFromStream(hrData, timeData, zones) {
	const result = zones.map(z => ({ ...z, time_seconds: 0 }));

	for (let i = 1; i < hrData.length; i++) {
		const hr = hrData[i];
		const dt = (timeData ? timeData[i] - timeData[i - 1] : 1);
		if (dt <= 0 || dt > 30) continue;

		for (let j = result.length - 1; j >= 0; j--) {
			if (hr >= result[j].min) {
				result[j].time_seconds += dt;
				break;
			}
		}
	}

	return result;
}

export async function POST({ params, platform }) {
	const env = getEnv(platform);
	const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const { data: activity } = await supabase
		.from('rt_activities')
		.select('id, strava_id, streams, hr_zones, max_hr, user_id')
		.eq('id', params.id)
		.single();

	if (!activity) return json({ error: 'Activité introuvable' }, { status: 404 });

	if (activity.hr_zones) {
		return json({ hr_zones: activity.hr_zones, cached: true });
	}

	const { data: user } = await supabase
		.from('rt_users')
		.select('*')
		.limit(1)
		.single();

	if (!user) return json({ error: 'Utilisateur non trouvé' }, { status: 400 });

	const accessToken = await getValidToken(user, env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, supabase);

	// Try athlete's custom zones from Strava
	let zones = null;
	try {
		const zoneRes = await fetch('https://www.strava.com/api/v3/athlete/zones', {
			headers: { 'Authorization': `Bearer ${accessToken}` }
		});
		if (zoneRes.ok) {
			const zoneData = await zoneRes.json();
			const hrZones = zoneData?.heart_rate?.zones;
			if (hrZones && hrZones.length > 0) {
				const labels = ['Récupération', 'Endurance', 'Tempo', 'Seuil', 'VO2max'];
				zones = hrZones.map((z, i) => ({
					zone: i + 1,
					label: labels[i] || `Zone ${i + 1}`,
					min: z.min,
					max: z.max
				}));
			}
		}
	} catch (e) {
		console.error('Could not fetch athlete zones:', e);
	}

	// Fallback to default zones
	if (!zones) {
		const { data: profile } = await supabase
			.from('rt_profile')
			.select('date_of_birth, max_hr')
			.limit(1)
			.single();

		// Use profile max HR, or find highest across all activities, or estimate from age
		let maxHR = profile?.max_hr || 190;

		if (!profile?.max_hr) {
			// Find the highest max_hr across all activities
			const { data: hrRecord } = await supabase
				.from('rt_activities')
				.select('max_hr')
				.not('max_hr', 'is', null)
				.order('max_hr', { ascending: false })
				.limit(1)
				.single();

			if (hrRecord?.max_hr) {
				maxHR = hrRecord.max_hr;
			}
		}

		if (profile?.date_of_birth) {
			const age = Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
			maxHR = Math.max(maxHR, 220 - age);
		}
		zones = defaultZones(maxHR);
	}

	// Get HR stream - from cache or fetch
	let hrArray = null;
	let timeArray = null;

	if (activity.streams?.heartrate) {
		hrArray = activity.streams.heartrate;
		timeArray = activity.streams.time || null;
	} else {
		try {
			const streamRes = await fetch(
				`https://www.strava.com/api/v3/activities/${activity.strava_id}/streams?keys=heartrate,time&key_by_type=true`,
				{ headers: { 'Authorization': `Bearer ${accessToken}` } }
			);
			if (streamRes.ok) {
				const streamData = await streamRes.json();
				hrArray = streamData?.heartrate?.data;
				timeArray = streamData?.time?.data;
			}
		} catch (e) {
			console.error('Could not fetch HR stream:', e);
		}
	}

	if (!hrArray || hrArray.length === 0) {
		return json({ error: 'Pas de données FC pour cette activité' }, { status: 404 });
	}

	const hrZones = computeZonesFromStream(hrArray, timeArray, zones);

	const totalTime = hrZones.reduce((s, z) => s + z.time_seconds, 0);
	hrZones.forEach(z => {
		z.pct = totalTime > 0 ? Math.round((z.time_seconds / totalTime) * 100) : 0;
	});

	await supabase
		.from('rt_activities')
		.update({ hr_zones: hrZones })
		.eq('id', params.id);

	return json({ hr_zones: hrZones, cached: false });
}
