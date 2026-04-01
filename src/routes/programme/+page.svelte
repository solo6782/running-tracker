<script>
	import { onMount } from 'svelte';

	// === STATE ===
	let loading = true;
	let saving = false;
	let saveTimeout;

	// Programmes (multi-race)
	let programmes = [];
	let selectedIdx = 0;
	let showAddForm = false;

	// Current programme fields (synced with selected)
	let programmeId = null;
	let programCreated = false;
	let raceName = '';
	let raceDate = '';
	let raceDistance = '';
	let raceLocation = '';
	let raceElevation = null;
	let raceProfile = '';
	let raceUrl = '';
	let objectiveType = 'finish';
	let objectiveTime = '';

	// Profile
	let dob = '';
	let weightKg = '';
	let heightCm = '';
	let restingHr = '';
	let maxHr = '';
	let profileNotes = '';
	let profileLoaded = false;

	// Search
	let searching = false;
	let searchResult = null;
	let searchError = '';

	// Coaching
	let generating = false;
	let coachingSummary = '';
	let coachingLevel = '';
	let coachingVolume = '';
	let coachingError = '';

	// Analysis
	let analyzing = false;
	let analysisData = null;
	let analysisError = '';

	// Prediction
	let predicting = false;
	let predictionData = null;
	let predictionError = '';

	// Withings
	let withingsConnected = false;
	let withingsLatest = {};
	let withingsLoading = false;
	let withingsError = '';

	// Calendar
	let availability = {};

	// === COMPUTED ===
	$: calendarDays = generateDays(raceDate);
	$: daysUntilRace = raceDate ? Math.ceil((new Date(raceDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
	$: weeksUntilRace = Math.ceil(daysUntilRace / 7);
	$: runDays = Object.values(availability).filter(d => d.run).length;
	$: rideDays = Object.values(availability).filter(d => d.ride).length;
	$: bothDays = Object.values(availability).filter(d => d.run && d.ride).length;
	$: nothingDays = Object.values(availability).filter(d => !d.run && !d.ride).length;
	$: hasPlan = Object.values(availability).some(d => d.plan);

	// Map of other races' plans + race days to overlay on calendar
	$: otherRacesMap = buildOtherRacesMap(programmes, selectedIdx);

	function buildOtherRacesMap(progs, currentIdx) {
		const map = {};
		for (let i = 0; i < progs.length; i++) {
			if (i === currentIdx) continue;
			const p = progs[i];
			// Mark this race's day
			if (p.race_date) {
				if (!map[p.race_date]) map[p.race_date] = {};
				map[p.race_date].isOtherRaceDay = true;
				map[p.race_date].raceName = p.race_name;
				map[p.race_date].raceDistance = p.race_distance_km;
			}
			// Overlay plans from earlier races
			const avail = p.availability || {};
			for (const [date, val] of Object.entries(avail)) {
				if (date.startsWith('_')) continue; // skip _ai_analysis
				if (val?.plan) {
					if (!map[date]) map[date] = {};
					// Only overlay if it's from a race BEFORE the current one
					if (p.race_date < progs[currentIdx]?.race_date) {
						map[date].otherPlan = val.plan;
						map[date].fromRace = p.race_name;
					}
				}
			}
		}
		return map;
	}

	// === LIFECYCLE ===
	onMount(async () => {
		try {
			const [progRes, profRes] = await Promise.all([
				fetch('/api/programme?all=1'),
				fetch('/api/profile')
			]);
			const progData = await progRes.json();
			const profData = await profRes.json();

			if (progData.programmes && progData.programmes.length > 0) {
				programmes = progData.programmes;
				selectProgramme(0);
			}
			if (profData.profile) loadProfile(profData.profile);

			// Check Withings connection (auto-sync once per day)
			const today = new Date().toISOString().split('T')[0];
			const lastSync = localStorage.getItem('withings_last_sync');
			const needsSync = lastSync !== today;
			fetchWithings(needsSync).then(() => {
				if (needsSync && withingsConnected) {
					localStorage.setItem('withings_last_sync', today);
				}
			});

			// Check URL params for Withings redirect result
			const params = new URLSearchParams(window.location.search);
			if (params.get('withings') === 'connected') {
				fetchWithings(true);
				window.history.replaceState({}, '', '/programme');
			}
		} catch (err) {
			console.error('Load error:', err);
		} finally {
			loading = false;
			profileLoaded = true;
		}
	});

	async function fetchWithings(sync = false) {
		withingsLoading = true;
		try {
			const res = await fetch(`/api/withings${sync ? '?sync=1' : ''}`);
			const data = await res.json();
			withingsConnected = data.connected;
			if (data.connected && data.latest) {
				withingsLatest = data.latest;
				// Auto-fill weight if available and empty
				if (data.latest.weight && !weightKg) {
					weightKg = data.latest.weight.value;
					debounceProfileSave();
				}
			}
		} catch (err) {
			console.error('Withings load error:', err);
		} finally {
			withingsLoading = false;
		}
	}

	async function syncWithings() {
		await fetchWithings(true);
		if (withingsConnected) {
			localStorage.setItem('withings_last_sync', new Date().toISOString().split('T')[0]);
		}
	}

	function selectProgramme(idx) {
		if (idx < 0 || idx >= programmes.length) return;
		selectedIdx = idx;
		loadProgramme(programmes[idx]);
	}

	function loadProgramme(p) {
		programmeId = p.id;
		raceName = p.race_name;
		raceDate = p.race_date;
		raceDistance = p.race_distance_km;
		raceLocation = p.race_location || '';
		raceElevation = p.race_elevation_gain;
		raceProfile = p.race_profile || '';
		raceUrl = p.race_url || '';
		objectiveType = p.objective_type || 'finish';
		objectiveTime = p.objective_time || '';
		availability = p.availability || {};
		programCreated = true;
		showAddForm = false;

		// Load saved AI analysis
		if (availability._ai_analysis) {
			analysisData = availability._ai_analysis;
		} else {
			analysisData = null;
		}

		// Load coaching summary from saved meta
		if (availability._coaching_meta) {
			coachingSummary = availability._coaching_meta.summary || '';
			coachingLevel = availability._coaching_meta.level || '';
			coachingVolume = availability._coaching_meta.volume || '';
		} else {
			coachingSummary = '';
			coachingLevel = '';
			coachingVolume = '';
		}

		// Load prediction
		if (availability._prediction) {
			predictionData = availability._prediction;
		} else {
			predictionData = null;
		}
	}

	function loadProfile(p) {
		dob = p.date_of_birth || '';
		weightKg = p.weight_kg || '';
		heightCm = p.height_cm || '';
		restingHr = p.resting_hr || '';
		maxHr = p.max_hr || '';
		profileNotes = p.notes || '';
	}

	// === SEARCH ===
	async function searchRace() {
		if (!raceName || raceName.length < 3) return;
		searching = true; searchError = ''; searchResult = null;
		try {
			const res = await fetch('/api/race-search', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: raceName })
			});
			const data = await res.json();
			if (data.error) { searchError = data.error; }
			else if (data.found) {
				searchResult = data;
				if (data.name) raceName = data.name;
				if (data.date) raceDate = data.date;
				if (data.distance_km) raceDistance = data.distance_km;
				if (data.location) raceLocation = data.location;
				if (data.elevation_gain) raceElevation = data.elevation_gain;
				if (data.profile) raceProfile = data.profile;
				if (data.url) raceUrl = data.url;
			} else { searchError = 'Course non trouvée. Remplis manuellement.'; }
		} catch (err) { searchError = err.message; }
		finally { searching = false; }
	}

	// === PROFILE SAVE ===
	let profileSaveTimeout;
	function debounceProfileSave() {
		clearTimeout(profileSaveTimeout);
		profileSaveTimeout = setTimeout(saveProfile, 800);
	}
	async function saveProfile() {
		if (!profileLoaded) return;
		try {
			await fetch('/api/profile', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date_of_birth: dob || null,
					weight_kg: weightKg ? parseFloat(weightKg) : null,
					height_cm: heightCm ? parseInt(heightCm) : null,
					resting_hr: restingHr ? parseInt(restingHr) : null,
					max_hr: maxHr ? parseInt(maxHr) : null,
					notes: profileNotes || null
				})
			});
		} catch (err) { console.error('Profile save error:', err); }
	}

	// === CALENDAR ===
	const dayNames = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
	const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

	function toLocalDateStr(d) {
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	}

	function generateDays(raceDateStr) {
		if (!raceDateStr) return [];
		const today = new Date(); today.setHours(0,0,0,0);
		const end = new Date(raceDateStr + 'T00:00:00'); // parse as local
		if (end <= today) return [];

		const days = [];
		let current = new Date(today);
		while (current <= end) {
			const dateStr = toLocalDateStr(current);
			const dow = current.getDay();
			days.push({
				date: dateStr,
				dayNum: current.getDate(),
				month: current.getMonth(),
				year: current.getFullYear(),
				dayName: dayNames[dow],
				isToday: current.getTime() === today.getTime(),
				isRaceDay: current.getTime() === end.getTime(),
				isMonday: dow === 1,
				isWeekend: dow === 0 || dow === 6
			});
			current.setDate(current.getDate() + 1);
		}
		return days;
	}

	function toggleAvailability(dateStr, type) {
		if (!availability[dateStr]) availability[dateStr] = { run: false, ride: false };
		availability[dateStr][type] = !availability[dateStr][type];
		// If both off, clear the plan for this day
		if (!availability[dateStr].run && !availability[dateStr].ride) {
			delete availability[dateStr].plan;
		}
		availability = availability;
		debounceSave();
	}

	function debounceSave() {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(saveAvailability, 500);
	}

	async function saveAvailability() {
		if (!programmeId) return;
		saving = true;
		try {
			await fetch('/api/programme', {
				method: 'PATCH', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: programmeId, availability })
			});
		} catch (err) { console.error(err); }
		finally { saving = false; }
	}

	// === PROGRAMME CRUD ===
	async function createProgram() {
		if (!raceName || !raceDate || !raceDistance) return;
		saving = true;
		// Init availability
		for (const day of generateDays(raceDate)) {
			if (!day.isRaceDay && !availability[day.date]) {
				availability[day.date] = { run: true, ride: true };
			}
		}
		availability = availability;
		try {
			const res = await fetch('/api/programme', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					race_name: raceName, race_date: raceDate,
					race_distance_km: parseFloat(raceDistance),
					race_location: raceLocation || null,
					race_elevation_gain: raceElevation || null,
					race_profile: raceProfile || null,
					race_url: raceUrl || null,
					race_description: searchResult?.description || null,
					objective_type: objectiveType,
					objective_time: objectiveType === 'time' ? objectiveTime : null,
					availability
				})
			});
			const data = await res.json();
			if (data.programme) {
				programmes = [...programmes, data.programme].sort((a, b) => a.race_date.localeCompare(b.race_date));
				selectedIdx = programmes.findIndex(p => p.id === data.programme.id);
				loadProgramme(data.programme);
			}
		} catch (err) { console.error(err); }
		finally { saving = false; }
		await saveProfile();
	}

	async function deleteRace() {
		if (!programmeId) return;
		if (!confirm(`Supprimer "${raceName}" ?`)) return;
		await fetch(`/api/programme?id=${programmeId}`, { method: 'DELETE' });
		programmes = programmes.filter(p => p.id !== programmeId);
		if (programmes.length > 0) {
			selectProgramme(0);
		} else {
			programCreated = false; programmeId = null; availability = {};
			raceName = ''; raceDate = ''; raceDistance = '';
			raceLocation = ''; raceElevation = null; raceProfile = ''; raceUrl = '';
			objectiveType = 'finish'; objectiveTime = '';
			searchResult = null; coachingSummary = ''; coachingLevel = '';
			analysisData = null; predictionData = null;
		}
	}

	function showAddRaceForm() {
		showAddForm = true;
		programmeId = null; raceName = ''; raceDate = ''; raceDistance = '';
		raceLocation = ''; raceElevation = null; raceProfile = ''; raceUrl = '';
		objectiveType = 'finish'; objectiveTime = '';
		searchResult = null; searchError = '';
		availability = {};
	}

	function cancelAddRace() {
		showAddForm = false;
		if (programmes.length > 0) {
			selectProgramme(selectedIdx);
		}
	}

	function setAllDays(type, value) {
		for (const day of calendarDays) {
			if (!day.isRaceDay) {
				if (!availability[day.date]) availability[day.date] = { run: false, ride: false };
				availability[day.date][type] = value;
				// If both off, clear the plan
				if (!availability[day.date].run && !availability[day.date].ride) {
					delete availability[day.date].plan;
				}
			}
		}
		availability = availability;
		debounceSave();
	}

	// === COACHING ===
	async function generatePlan() {
		if (!programmeId) return;
		generating = true; coachingError = '';
		try {
			const res = await fetch('/api/coaching', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ programmeId })
			});
			const data = await res.json();
			if (data.error) { coachingError = data.error; }
			else if (data.success) {
				availability = data.availability;
				coachingSummary = data.summary;
				coachingLevel = data.level;
				coachingVolume = data.weekly_volume_target;
				// Save coaching meta for persistence
				availability._coaching_meta = {
					summary: data.summary,
					level: data.level,
					volume: data.weekly_volume_target
				};
				saveAvailability();
			}
		} catch (err) { coachingError = err.message; }
		finally { generating = false; }
	}

	async function generateAnalysis() {
		if (!programmeId) return;
		analyzing = true; analysisError = '';
		try {
			const res = await fetch('/api/coaching/analysis', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ programmeId })
			});
			const data = await res.json();
			if (data.error) { analysisError = data.error; }
			else if (data.success) {
				analysisData = data;
			}
		} catch (err) { analysisError = err.message; }
		finally { analyzing = false; }
	}

	async function generatePrediction() {
		if (!programmeId) return;
		predicting = true; predictionError = '';
		try {
			const res = await fetch('/api/coaching/prediction', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(programmeId
					? { programmeId }
					: { race_name: raceName, race_date: raceDate, race_distance_km: raceDistance, race_elevation_gain: raceElevation, race_profile: raceProfile, objective_type: objectiveType, objective_time: objectiveTime }
				)
			});
			const data = await res.json();
			if (data.error) { predictionError = data.error; }
			else if (data.success) {
				predictionData = data.prediction;
				// Save for persistence if programme exists
				if (programmeId) {
					availability._prediction = data.prediction;
					saveAvailability();
				}
			}
		} catch (err) { predictionError = err.message; }
		finally { predicting = false; }
	}

	async function estimateObjective() {
		predicting = true;
		predictionError = '';
		try {
			const payload = programmeId
				? { programmeId }
				: { race_name: raceName, race_date: raceDate, race_distance_km: parseFloat(raceDistance) || 21.1, race_elevation_gain: raceElevation ? parseInt(raceElevation) : null, race_profile: raceProfile || '', objective_type: objectiveType, objective_time: objectiveTime };

			const res = await fetch('/api/coaching/prediction', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();
			if (data.error) {
				predictionError = data.error;
			} else if (data.success && data.prediction) {
				predictionData = data.prediction;
				const bestEstimate = data.prediction.race_day?.realistic || data.prediction.realistic;
				objectiveTime = bestEstimate;
				objectiveType = 'time';
				if (programmeId) {
					availability._prediction = data.prediction;
					saveAvailability();
					fetch('/api/programme', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id: programmeId, objective_type: 'time', objective_time: bestEstimate })
					});
				}
			} else {
				predictionError = 'Réponse inattendue du serveur';
			}
		} catch (err) {
			predictionError = err.message || 'Erreur de connexion';
		} finally {
			predicting = false;
		}
	}

	// === HELPERS ===
	const distances = [
		{ label: '5K', value: 5 }, { label: '10K', value: 10 },
		{ label: 'Semi', value: 21.1 }, { label: 'Marathon', value: 42.195 },
		{ label: 'Ultra', value: 0 }
	];

	function intensityColor(i) {
		if (i === 'high') return 'var(--danger)';
		if (i === 'moderate') return 'var(--warning)';
		return 'var(--success)';
	}
	function sportEmoji(s) { return s === 'ride' ? '🚴' : s === 'rest' ? '😴' : '🏃'; }
	function typeLabel(t) {
		const map = { easy: 'Endurance', tempo: 'Seuil', intervals: 'Fractionné', long: 'Sortie longue', recovery: 'Récup', cross: 'Cross-training', rest: 'Repos' };
		return map[t] || t;
	}

	// === GARMIN EXPORT ===
	function paceToMps(paceStr) {
		// "5:30" (min/km) → m/s
		if (!paceStr) return null;
		const [min, sec] = paceStr.split(':').map(Number);
		const totalSec = min * 60 + (sec || 0);
		return 1000 / totalSec; // m/s
	}

	const stepTypeMap = { warmup: { id: 1, key: 'warmup' }, interval: { id: 3, key: 'interval' }, cooldown: { id: 2, key: 'cooldown' }, recovery: { id: 4, key: 'recovery' } };
	const endCondMap = { time: { id: 2, key: 'time' }, distance: { id: 3, key: 'distance' }, 'lap.button': { id: 1, key: 'lap.button' } };

	function buildGarminStep(step, order, childStepId = null) {
		const st = stepTypeMap[step.step_type] || stepTypeMap.interval;
		const ec = endCondMap[step.end_type] || endCondMap.distance;
		const hasPace = step.pace_target && step.pace_target.min_per_km && step.pace_target.max_per_km;
		return {
			type: 'ExecutableStepDTO',
			stepId: null,
			stepOrder: order,
			stepType: { stepTypeId: st.id, stepTypeKey: st.key, displayOrder: st.id },
			childStepId: childStepId,
			description: step.description || null,
			endCondition: { conditionTypeId: ec.id, conditionTypeKey: ec.key, displayOrder: ec.id, displayable: true },
			endConditionValue: step.end_value || 0,
			preferredEndConditionUnit: step.end_type === 'distance' && step.end_value >= 1000
				? { unitId: 2, unitKey: 'kilometer', factor: 100000.0 } : null,
			endConditionCompare: null,
			targetType: hasPace
				? { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone', displayOrder: 6 }
				: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 1 },
			targetValueOne: hasPace ? paceToMps(step.pace_target.min_per_km) : null,
			targetValueTwo: hasPace ? paceToMps(step.pace_target.max_per_km) : null,
			targetValueUnit: null,
			zoneNumber: null,
			secondaryTargetType: null, secondaryTargetValueOne: null, secondaryTargetValueTwo: null,
			secondaryTargetValueUnit: null, secondaryZoneNumber: null, endConditionZone: null,
			strokeType: { strokeTypeId: 0, strokeTypeKey: null, displayOrder: 0 },
			equipmentType: { equipmentTypeId: 0, equipmentTypeKey: null, displayOrder: 0 },
			category: null, exerciseName: null, workoutProvider: null,
			providerExerciseSourceId: null, weightValue: null, weightUnit: null
		};
	}

	function buildGarminJson(plan, date) {
		if (!plan.garmin_steps || plan.sport !== 'run') return null;
		const workoutSteps = [];
		let order = 1;

		for (const step of plan.garmin_steps) {
			if (step.type === 'repeat') {
				const repeatSteps = [];
				const childId = order;
				for (const sub of (step.steps || [])) {
					repeatSteps.push(buildGarminStep(sub, order + 1, childId));
					order++;
				}
				workoutSteps.push({
					type: 'RepeatGroupDTO',
					stepId: null,
					stepOrder: order,
					stepType: { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 6 },
					childStepId: childId,
					numberOfIterations: step.iterations || 1,
					workoutSteps: repeatSteps,
					endConditionValue: step.iterations || 1,
					preferredEndConditionUnit: null,
					endConditionCompare: null,
					endCondition: { conditionTypeId: 7, conditionTypeKey: 'iterations', displayOrder: 7, displayable: false },
					skipLastRestStep: true,
					smartRepeat: false
				});
			} else {
				workoutSteps.push(buildGarminStep(step, order));
			}
			order++;
		}

		return {
			workoutName: `${plan.title} — ${date}`,
			description: plan.description || null,
			sportType: { sportTypeId: 1, sportTypeKey: 'running', displayOrder: 1 },
			subSportType: null,
			trainingPlanId: null,
			estimatedDurationInSecs: (plan.duration_min || 0) * 60,
			estimatedDistanceInMeters: (plan.distance_km || 0) * 1000,
			workoutSegments: [{
				segmentOrder: 1,
				sportType: { sportTypeId: 1, sportTypeKey: 'running', displayOrder: 1 },
				poolLengthUnit: null,
				poolLength: null,
				workoutSteps
			}],
			poolLength: null,
			poolLengthUnit: null,
			locale: null,
			estimateType: null,
			shared: false
		};
	}

	function downloadGarmin(plan, date) {
		const json = buildGarminJson(plan, date);
		if (!json) return;
		const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${plan.title.replace(/[^a-zA-Z0-9àâéèêëïîôùûüçÀÂÉÈÊËÏÎÔÙÛÜÇ ]/g, '').replace(/ /g, '_')}_${date}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<script context="module">
	function formatRaceDate(dateStr) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const months = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
		const days = ['dim','lun','mar','mer','jeu','ven','sam'];
		return `${days[d.getDay()]}. ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
	}
	function computePace(timeStr, distanceKm) {
		if (!timeStr || !distanceKm) return '';
		const parts = timeStr.split(':').map(Number);
		let totalSeconds = parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2] : parts[0]*60+parts[1];
		const paceSeconds = totalSeconds / distanceKm;
		return `${Math.floor(paceSeconds/60)}:${String(Math.round(paceSeconds%60)).padStart(2,'0')}`;
	}
</script>

<svelte:head>
	<title>Programme Course — Running Tracker</title>
</svelte:head>

<div class="page">

{#if loading}
	<div class="loading-state"><span class="spinner-lg"></span><p>Chargement...</p></div>

{:else if programmes.length === 0 || showAddForm}
<!-- ===== SETUP ===== -->
<div class="setup-section">
	<div class="setup-header">
		<span class="setup-icon">🎯</span>
		<h1>{showAddForm ? 'Ajouter une course' : 'Nouveau programme'}</h1>
		<p class="setup-sub">Configure ta course et ton profil</p>
		{#if showAddForm}
			<button class="btn-cancel-add" on:click={cancelAddRace}>← Retour</button>
		{/if}
	</div>

	<div class="form-card">
		<h2 class="form-section-title">🏁 Course</h2>

		<div class="field">
			<label for="race-name">Nom de la course</label>
			<div class="search-row">
				<input id="race-name" type="text" bind:value={raceName} placeholder="Ex: Marathon de Paris"
					on:keydown={(e) => e.key === 'Enter' && searchRace()} />
				<button class="btn-search" on:click={searchRace} disabled={searching || raceName.length < 3}>
					{#if searching}<span class="spinner"></span>{:else}🔍{/if}
				</button>
			</div>
			<span class="field-hint-subtle">Tape le nom et clique 🔍 pour remplir auto</span>
		</div>

		{#if searchResult}
			<div class="search-result">
				<div class="sr-header">
					<span>✅</span><strong>{searchResult.name}</strong>
					<button class="sr-dismiss" on:click={() => { searchResult = null; }}>✕</button>
				</div>
				<div class="sr-details">
					{#if searchResult.location}<span class="sr-tag">📍 {searchResult.location}</span>{/if}
					{#if searchResult.date}<span class="sr-tag">📅 {searchResult.date}</span>{/if}
					{#if searchResult.distance_km}<span class="sr-tag">📏 {searchResult.distance_km}km</span>{/if}
					{#if searchResult.elevation_gain}<span class="sr-tag">⛰️ D+{searchResult.elevation_gain}m</span>{/if}
					{#if searchResult.profile}<span class="sr-tag">🗺️ {searchResult.profile}</span>{/if}
				</div>
				{#if searchResult.distances?.length > 1}
					<div class="sr-distances">
						<span class="sr-dist-label">Distances :</span>
						{#each searchResult.distances as d}
							<button class="sr-dist-btn" on:click={() => {
								const km = parseFloat(d);
								if (!isNaN(km)) raceDistance = km;
								else if (d.toLowerCase().includes('semi')) raceDistance = 21.1;
								else if (d.toLowerCase().includes('marathon')) raceDistance = 42.195;
								else if (d.toLowerCase().includes('10')) raceDistance = 10;
								else if (d.toLowerCase().includes('5')) raceDistance = 5;
							}}>{d}</button>
						{/each}
					</div>
				{/if}
				{#if searchResult.description}<p class="sr-desc">{searchResult.description}</p>{/if}
				{#if searchResult.url}<a href={searchResult.url} target="_blank" rel="noopener" class="sr-link">🔗 Site officiel</a>{/if}
			</div>
		{/if}
		{#if searchError}<div class="search-error">{searchError}</div>{/if}

		<div class="field">
			<label for="race-date">Date de la course</label>
			<input id="race-date" type="date" bind:value={raceDate} min={new Date().toISOString().split('T')[0]} />
			{#if daysUntilRace > 0}<span class="field-hint">Dans {daysUntilRace} jours ({weeksUntilRace} sem.)</span>{/if}
		</div>

		<div class="field">
			<label>Distance</label>
			<div class="distance-presets">
				{#each distances as d}
					<button class="preset-btn" class:active={d.value > 0 && parseFloat(raceDistance) === d.value}
						on:click={() => raceDistance = d.value > 0 ? d.value : ''}>{d.label}</button>
				{/each}
			</div>
			<div class="input-row">
				<input type="number" bind:value={raceDistance} placeholder="Distance" step="0.1" min="0" />
				<span class="unit">km</span>
			</div>
		</div>

		<div class="field">
			<label>Objectif</label>
			<div class="toggle-row">
				<button class="obj-btn" class:active={objectiveType === 'finish'} on:click={() => objectiveType = 'finish'}>🏁 Juste finir</button>
				<button class="obj-btn" class:active={objectiveType === 'time'} on:click={() => objectiveType = 'time'}>⏱️ Temps cible</button>
			</div>
			{#if objectiveType === 'time'}
				<div class="objective-row">
					<input type="text" bind:value={objectiveTime} placeholder="Ex: 1:45:00" />
					<button type="button" class="btn-estimate" on:click={estimateObjective} disabled={predicting}>
						{predicting ? '⏳' : '🎯'} Estimer
					</button>
				</div>
				{#if objectiveTime && raceDistance}<span class="field-hint">≈ {computePace(objectiveTime, raceDistance)} /km</span>{/if}
				{#if predictionData}
					<div class="mini-predictions">
						<button class="mini-pred" on:click={() => { objectiveTime = predictionData.race_day?.optimistic || predictionData.optimistic; }}>🚀 {predictionData.race_day?.optimistic || predictionData.optimistic}</button>
						<button class="mini-pred selected" on:click={() => { objectiveTime = predictionData.race_day?.realistic || predictionData.realistic; }}>🎯 {predictionData.race_day?.realistic || predictionData.realistic}</button>
						<button class="mini-pred" on:click={() => { objectiveTime = predictionData.race_day?.conservative || predictionData.conservative; }}>🛡️ {predictionData.race_day?.conservative || predictionData.conservative}</button>
					</div>
					{#if predictionData.analysis}
						<p class="pred-hint">{predictionData.analysis}</p>
					{/if}
				{/if}
				{#if predictionError}<span class="field-hint" style="color: var(--danger)">{predictionError}</span>{/if}
			{/if}
		</div>

		<!-- PROFILE SECTION -->
		<h2 class="form-section-title">👤 Profil athlète</h2>

		<!-- Withings connection -->
		<div class="withings-row">
			{#if withingsConnected}
				<div class="withings-status connected">
					<span>✅ Withings connecté</span>
					{#if withingsLatest.weight}
						<span class="ws-val">{withingsLatest.weight.value}kg</span>
					{/if}
					{#if withingsLatest.fat_ratio}
						<span class="ws-val">{withingsLatest.fat_ratio.value}% gras</span>
					{/if}
					{#if withingsLatest.muscle_mass}
						<span class="ws-val">{withingsLatest.muscle_mass.value}kg muscles</span>
					{/if}
					{#if withingsLatest.fat_mass}
						<span class="ws-val">{withingsLatest.fat_mass.value}kg m.grasse</span>
					{/if}
					{#if withingsLatest.hydration}
						<span class="ws-val">{withingsLatest.hydration.value}kg hydrat.</span>
					{/if}
					{#if withingsLatest.bone_mass}
						<span class="ws-val">{withingsLatest.bone_mass.value}kg os</span>
					{/if}
					<button class="btn-sync" on:click={syncWithings} disabled={withingsLoading}>
						{#if withingsLoading}<span class="spinner-sm"></span>{:else}🔄{/if}
					</button>
				</div>
			{:else}
				<a href="/auth/withings" class="btn-withings">
					{#if withingsLoading}<span class="spinner"></span>{:else}⚖️{/if}
					Connecter Withings
				</a>
				<span class="field-hint-subtle">Récupère poids, masse grasse, muscles automatiquement</span>
			{/if}
		</div>

		<div class="field-row">
			<div class="field">
				<label for="dob">Date de naissance</label>
				<input id="dob" type="date" bind:value={dob} />
			</div>
			<div class="field">
				<label for="weight">Poids (kg)</label>
				<input id="weight" type="number" bind:value={weightKg} placeholder="75" step="0.1" />
			</div>
		</div>
		<div class="field-row">
			<div class="field">
				<label for="height">Taille (cm)</label>
				<input id="height" type="number" bind:value={heightCm} placeholder="175" />
			</div>
			<div class="field">
				<label for="rhr">FC repos (bpm)</label>
				<input id="rhr" type="number" bind:value={restingHr} placeholder="60" />
			</div>
			<div class="field">
				<label for="mhr">FC max (bpm)</label>
				<input id="mhr" type="number" bind:value={maxHr} placeholder="190" />
			</div>
		</div>
		<div class="field">
			<label for="notes">Notes (blessures, contraintes...)</label>
			<textarea id="notes" bind:value={profileNotes} rows="2" placeholder="Ex: tendinite achille gauche, pas de fractionné côtes"></textarea>
		</div>

		<button class="btn-create" on:click={createProgram}
			disabled={!raceName || !raceDate || !raceDistance || saving}>
			{#if saving}<span class="spinner"></span> Création...{:else}Créer le programme →{/if}
		</button>
	</div>
</div>

{:else}
<!-- ===== PROGRAMME VIEW ===== -->

<!-- Race Tabs -->
{#if programmes.length > 1}
<div class="race-tabs">
	{#each programmes as prog, i}
		<button class="race-tab" class:active={i === selectedIdx} on:click={() => selectProgramme(i)}>
			<span class="rt-name">{prog.race_name}</span>
			<span class="rt-date">{formatRaceDate(prog.race_date)}</span>
			<span class="rt-dist">{prog.race_distance_km}km</span>
		</button>
	{/each}
	<button class="race-tab add-tab" on:click={showAddRaceForm}>+ Ajouter</button>
</div>
{/if}

<!-- Race Header -->
<div class="race-header">
	<div class="race-info">
		<h1>{raceName}</h1>
		<div class="race-meta">
			<span class="race-tag">{raceDistance}km</span>
			{#if raceLocation}<span class="race-tag">📍 {raceLocation}</span>{/if}
			<span class="race-tag">{formatRaceDate(raceDate)}</span>
			<span class="race-tag accent">J-{daysUntilRace}</span>
			{#if raceElevation}<span class="race-tag">⛰️ D+{raceElevation}m</span>{/if}
			{#if objectiveType === 'time' && objectiveTime}
				<span class="race-tag goal">🎯 {objectiveTime}</span>
			{:else}
				<span class="race-tag goal">🏁 Finir</span>
			{/if}
			<button type="button" class="race-tag estimate-tag" on:click={estimateObjective} disabled={predicting}>
				{predicting ? '⏳...' : '🎯 Estimer'}
			</button>
		</div>
	</div>
	<div class="header-actions">
		{#if programmes.length <= 1}
			<button class="btn-sm" on:click={showAddRaceForm}>+ Ajouter une course</button>
		{/if}
		<button class="btn-sm danger" on:click={deleteRace}>🗑️</button>
		{#if raceUrl}<a href={raceUrl} target="_blank" rel="noopener" class="btn-sm">🔗</a>{/if}
		{#if saving}<span class="save-indicator"><span class="spinner-sm"></span></span>{/if}
	</div>
</div>

<!-- Profile Bar -->
<div class="profile-bar">
	<div class="pb-fields">
		<div class="pb-field">
			<label>Naissance</label>
			<input type="date" bind:value={dob} on:change={debounceProfileSave} />
		</div>
		<div class="pb-field">
			<label>Poids</label>
			<div class="pb-input-unit">
				<input type="number" bind:value={weightKg} on:input={debounceProfileSave} placeholder="—" step="0.1" />
				<span>kg</span>
			</div>
		</div>
		<div class="pb-field">
			<label>FC repos</label>
			<div class="pb-input-unit">
				<input type="number" bind:value={restingHr} on:input={debounceProfileSave} placeholder="—" />
				<span>bpm</span>
			</div>
		</div>
		<div class="pb-field">
			<label>FC max</label>
			<div class="pb-input-unit">
				<input type="number" bind:value={maxHr} on:input={debounceProfileSave} placeholder="—" />
				<span>bpm</span>
			</div>
		</div>
		{#if withingsConnected}
			<div class="pb-withings">
				{#if withingsLatest.fat_ratio}
					<div class="wb-val"><span class="wb-lbl">Gras</span> {withingsLatest.fat_ratio.value}%</div>
				{/if}
				{#if withingsLatest.muscle_mass}
					<div class="wb-val"><span class="wb-lbl">Muscles</span> {withingsLatest.muscle_mass.value}kg</div>
				{/if}
				{#if withingsLatest.fat_mass}
					<div class="wb-val"><span class="wb-lbl">M.grasse</span> {withingsLatest.fat_mass.value}kg</div>
				{/if}
				{#if withingsLatest.hydration}
					<div class="wb-val"><span class="wb-lbl">Hydrat.</span> {withingsLatest.hydration.value}kg</div>
				{/if}
				{#if withingsLatest.bone_mass}
					<div class="wb-val"><span class="wb-lbl">Os</span> {withingsLatest.bone_mass.value}kg</div>
				{/if}
				<button class="btn-sync-sm" on:click={syncWithings} disabled={withingsLoading} title="Synchroniser Withings">
					{#if withingsLoading}<span class="spinner-sm"></span>{:else}🔄{/if}
				</button>
			</div>
		{:else}
			<a href="/auth/withings" class="pb-connect">⚖️ Withings</a>
		{/if}
	</div>
</div>

<!-- Stats bar -->
<div class="stats-bar">
	<div class="stat-item"><span class="stat-num">{daysUntilRace}</span><span class="stat-lbl">jours</span></div>
	<div class="stat-sep"></div>
	<div class="stat-item run"><span class="stat-num">{runDays}</span><span class="stat-lbl">🏃 run</span></div>
	<div class="stat-item ride"><span class="stat-num">{rideDays}</span><span class="stat-lbl">🚴 vélo</span></div>
	<div class="stat-item both"><span class="stat-num">{bothDays}</span><span class="stat-lbl">les 2</span></div>
	<div class="stat-item none"><span class="stat-num">{nothingDays}</span><span class="stat-lbl">repos</span></div>
</div>

<!-- Quick Actions + AI -->
<div class="actions-row">
	<div class="quick-actions">
		<button class="qa-btn" on:click={() => setAllDays('run', true)}>✅ Tout run</button>
		<button class="qa-btn" on:click={() => setAllDays('ride', true)}>✅ Tout vélo</button>
		<button class="qa-btn" on:click={() => setAllDays('run', false)}>❌ Aucun run</button>
		<button class="qa-btn" on:click={() => setAllDays('ride', false)}>❌ Aucun vélo</button>
	</div>
	<button class="btn-ai" on:click={generatePlan} disabled={generating}>
		{#if generating}
			<span class="spinner"></span> Génération du plan...
		{:else}
			🤖 {hasPlan ? 'Regénérer le plan IA' : 'Générer le plan IA'}
		{/if}
	</button>
</div>

{#if coachingError}<div class="coaching-error">{coachingError}</div>{/if}

{#if coachingSummary}
	<div class="coaching-summary">
		<div class="cs-header">
			<span>🤖</span>
			<strong>Plan d'entraînement</strong>
			{#if coachingLevel}<span class="cs-tag">{coachingLevel}</span>{/if}
			{#if coachingVolume}<span class="cs-tag">{coachingVolume}</span>{/if}
		</div>
		<p>{coachingSummary}</p>
	</div>
{/if}

<!-- AI Analysis Card -->
<div class="analysis-card">
	{#if analysisData}
		<div class="an-header">
			<div class="an-title">
				<span>🧠</span>
				<strong>Analyse du coach IA</strong>
				<span class="an-badge" class:red={analysisData.readiness_score < 30} class:orange={analysisData.readiness_score >= 30 && analysisData.readiness_score < 50} class:yellow={analysisData.readiness_score >= 50 && analysisData.readiness_score < 70} class:green={analysisData.readiness_score >= 70 && analysisData.readiness_score < 90} class:purple={analysisData.readiness_score >= 90}>
					{analysisData.readiness_label}
				</span>
			</div>
			<div class="an-meta">
				{#if analysisData.readiness_score}
					<span class="an-score">{analysisData.readiness_score}/100</span>
				{/if}
				{#if analysisData.estimated_time}
					<span class="an-time">⏱️ {analysisData.estimated_time}</span>
				{/if}
				{#if analysisData.generated_at}
					<span class="an-date">{new Date(analysisData.generated_at).toLocaleDateString('fr-FR')}</span>
				{/if}
			</div>
		</div>
		<div class="an-body">
			{#each analysisData.analysis.split('\n\n') as paragraph}
				{#if paragraph.trim()}
					<p>{paragraph.trim()}</p>
				{/if}
			{/each}
		</div>
		<button class="an-refresh" on:click={generateAnalysis} disabled={analyzing}>
			{#if analyzing}<span class="spinner-sm"></span>{:else}🔄{/if} Actualiser l'analyse
		</button>
	{:else}
		<button class="btn-analysis" on:click={generateAnalysis} disabled={analyzing}>
			{#if analyzing}
				<span class="spinner"></span> Analyse en cours...
			{:else}
				🧠 Analyser mes chances
			{/if}
		</button>
		{#if analysisError}<div class="coaching-error">{analysisError}</div>{/if}
	{/if}
</div>

<!-- Prediction Card -->
<div class="prediction-card">
	{#if predictionData}
		<div class="pred-header">
			<span>🎯</span>
			<strong>Prédiction de temps</strong>
			<span class="pred-confidence" class:green={predictionData.confidence === 'élevée'} class:orange={predictionData.confidence === 'moyenne'} class:red={predictionData.confidence === 'faible'}>
				Confiance {predictionData.confidence}
			</span>
		</div>

		{#if predictionData.current}
			<div class="pred-section-label">🏃 Si tu courais aujourd'hui</div>
			<div class="pred-times">
				<div class="pred-time optimistic">
					<span class="pred-label">🚀 Optimiste</span>
					<span class="pred-value">{predictionData.current.optimistic}</span>
				</div>
				<div class="pred-time realistic">
					<span class="pred-label">🎯 Réaliste</span>
					<span class="pred-value">{predictionData.current.realistic}</span>
				</div>
				<div class="pred-time conservative">
					<span class="pred-label">🛡️ Prudent</span>
					<span class="pred-value">{predictionData.current.conservative}</span>
				</div>
			</div>
		{/if}

		{#if predictionData.race_day}
			<div class="pred-section-label">📈 Le jour de la course (avec entraînement)</div>
			<div class="pred-times">
				<div class="pred-time optimistic">
					<span class="pred-label">🚀 Optimiste</span>
					<span class="pred-value">{predictionData.race_day.optimistic}</span>
				</div>
				<div class="pred-time realistic">
					<span class="pred-label">🎯 Réaliste</span>
					<span class="pred-value">{predictionData.race_day.realistic}</span>
				</div>
				<div class="pred-time conservative">
					<span class="pred-label">🛡️ Prudent</span>
					<span class="pred-value">{predictionData.race_day.conservative}</span>
				</div>
			</div>
		{/if}

		{#if !predictionData.current && !predictionData.race_day}
			<!-- Backward compat: old format -->
			<div class="pred-times">
				<div class="pred-time optimistic">
					<span class="pred-label">🚀 Optimiste</span>
					<span class="pred-value">{predictionData.optimistic}</span>
				</div>
				<div class="pred-time realistic">
					<span class="pred-label">🎯 Réaliste</span>
					<span class="pred-value">{predictionData.realistic}</span>
				</div>
				<div class="pred-time conservative">
					<span class="pred-label">🛡️ Prudent</span>
					<span class="pred-value">{predictionData.conservative}</span>
				</div>
			</div>
		{/if}

		{#if predictionData.target_pace_per_km}
			<div class="pred-pace">Allure cible : <strong>{predictionData.target_pace_per_km}/km</strong></div>
		{/if}
		<div class="pred-analysis">
			<p>{predictionData.analysis}</p>
			{#if predictionData.strategy}
				<p class="pred-strategy">💡 {predictionData.strategy}</p>
			{/if}
		</div>
		<button type="button" class="an-refresh" on:click={estimateObjective} disabled={predicting}>
			{#if predicting}<span class="spinner-sm"></span>{:else}🔄{/if} Actualiser la prédiction
		</button>
	{:else}
		<button class="btn-prediction" on:click={generatePrediction} disabled={predicting}>
			{#if predicting}
				<span class="spinner"></span> Calcul en cours...
			{:else}
				🎯 Estimer mon temps de course
			{/if}
		</button>
		{#if predictionError}<div class="coaching-error">{predictionError}</div>{/if}
	{/if}
</div>

<!-- VERTICAL CALENDAR -->
<div class="v-calendar">
	{#each calendarDays as day, i}
		{@const a = availability[day.date]}
		{@const plan = a?.plan}
		{@const other = otherRacesMap[day.date]}
		{@const isNewWeek = day.isMonday && i > 0}
		{@const weekNum = Math.ceil((i + 1) / 7)}

		{#if isNewWeek}
			<div class="week-separator">
				<span>Semaine {weekNum}</span>
			</div>
		{/if}

		<div class="v-day"
			class:today={day.isToday}
			class:race-day={day.isRaceDay}
			class:other-race-day={other?.isOtherRaceDay}
			class:weekend={day.isWeekend}
			class:has-plan={!!plan || !!other?.otherPlan}
			class:rest={a && !a.run && !a.ride && !other?.isOtherRaceDay}
		>
			<!-- Date column -->
			<div class="v-date">
				<span class="v-dayname">{day.dayName}</span>
				<span class="v-daynum" class:today-ring={day.isToday}>{day.dayNum}</span>
				<span class="v-month">{monthNames[day.month]}</span>
			</div>

			<!-- Availability toggles -->
			{#if day.isRaceDay}
				<div class="v-race-badge">🏁 COURSE</div>
			{:else if other?.isOtherRaceDay}
				<div class="v-race-badge other">🏁 {other.raceName} ({other.raceDistance}km)</div>
			{:else}
				<div class="v-toggles">
					<button class="v-tog" class:on={a?.run} on:click={() => toggleAvailability(day.date, 'run')} title="Run">🏃</button>
					<button class="v-tog" class:on={a?.ride} on:click={() => toggleAvailability(day.date, 'ride')} title="Vélo">🚴</button>
				</div>
			{/if}

			<!-- Plan -->
			<div class="v-plan">
				{#if plan}
					<div class="plan-card" style="border-left-color: {intensityColor(plan.intensity)}">
						<div class="plan-top">
							<span class="plan-sport">{sportEmoji(plan.sport)}</span>
							<span class="plan-title">{plan.title}</span>
							<span class="plan-type" style="color: {intensityColor(plan.intensity)}">{typeLabel(plan.type)}</span>
							{#if plan.garmin_steps && plan.sport === 'run'}
								<button class="btn-garmin" on:click|stopPropagation={() => downloadGarmin(plan, day.date)} title="Télécharger pour Garmin">⌚</button>
							{/if}
						</div>
						<div class="plan-details">
							{#if plan.duration_min}<span>⏱ {plan.duration_min}min</span>{/if}
							{#if plan.distance_km}<span>📏 {plan.distance_km}km</span>{/if}
						</div>
						{#if plan.description}
							<p class="plan-desc">{plan.description}</p>
						{/if}
					</div>
				{:else if other?.otherPlan}
					<div class="plan-card other-plan" style="border-left-color: {intensityColor(other.otherPlan.intensity)}">
						<div class="plan-top">
							<span class="plan-sport">{sportEmoji(other.otherPlan.sport)}</span>
							<span class="plan-title">{other.otherPlan.title}</span>
							<span class="plan-type" style="color: {intensityColor(other.otherPlan.intensity)}">{typeLabel(other.otherPlan.type)}</span>
						</div>
						<div class="plan-details">
							{#if other.otherPlan.duration_min}<span>⏱ {other.otherPlan.duration_min}min</span>{/if}
							{#if other.otherPlan.distance_km}<span>📏 {other.otherPlan.distance_km}km</span>{/if}
							<span class="plan-from">📋 {other.fromRace}</span>
						</div>
						{#if other.otherPlan.description}
							<p class="plan-desc">{other.otherPlan.description}</p>
						{/if}
					</div>
				{:else if day.isRaceDay || other?.isOtherRaceDay}
					<!-- nothing -->
				{:else if a && !a.run && !a.ride}
					<span class="plan-rest">😴 Repos</span>
				{:else}
					<span class="plan-empty">—</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

{/if}
</div>

<style>
	.page { max-width: 900px; margin: 0 auto; padding: 24px 16px 60px; }

	/* Loading */
	.loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 0; color: var(--text-muted); }
	.spinner-lg { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
	.spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
	.spinner-sm { width: 12px; height: 12px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Setup Form */
	.setup-section { max-width: 560px; margin: 24px auto; }
	.setup-header { text-align: center; margin-bottom: 28px; }
	.setup-icon { font-size: 2.5rem; display: block; margin-bottom: 12px; }
	.setup-header h1 { font-size: 1.5rem; font-weight: 700; }
	.setup-sub { color: var(--text-muted); font-size: 0.88rem; margin-top: 4px; }

	.form-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px 24px; display: flex; flex-direction: column; gap: 18px; }
	.form-section-title { font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin: 8px 0 -4px; padding-top: 8px; border-top: 1px solid var(--border); }
	.form-section-title:first-of-type { border-top: none; padding-top: 0; }

	.field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
	.field label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
	.field input, .field textarea { background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-sans); font-size: 0.88rem; padding: 8px 12px; outline: none; }
	.field input:focus, .field textarea:focus { border-color: var(--accent); }
	.field textarea { resize: vertical; }
	.field-hint { font-size: 0.73rem; color: var(--accent-light); font-family: var(--font-mono); }
	.field-hint-subtle { font-size: 0.7rem; color: var(--text-muted); }

	.field-row { display: flex; gap: 12px; }
	.input-row { display: flex; align-items: center; gap: 8px; }
	.input-row input { flex: 1; }
	.unit { color: var(--text-muted); font-size: 0.82rem; font-family: var(--font-mono); }

	.search-row { display: flex; gap: 8px; }
	.search-row input { flex: 1; }
	.btn-search { background: var(--accent); border: none; border-radius: var(--radius-md); color: white; font-size: 1rem; padding: 0 14px; cursor: pointer; min-width: 44px; display: flex; align-items: center; justify-content: center; }
	.btn-search:hover { background: var(--accent-light); }
	.btn-search:disabled { opacity: 0.4; cursor: not-allowed; }

	.search-result { background: rgba(0,210,160,0.06); border: 1px solid rgba(0,210,160,0.2); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
	.sr-header { display: flex; align-items: center; gap: 8px; }
	.sr-header strong { flex: 1; font-size: 0.88rem; }
	.sr-dismiss { background: none; border: none; color: var(--text-muted); cursor: pointer; }
	.sr-details { display: flex; gap: 6px; flex-wrap: wrap; }
	.sr-tag { background: var(--bg-input); border: 1px solid var(--border); border-radius: 14px; font-size: 0.7rem; padding: 2px 8px; }
	.sr-distances { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
	.sr-dist-label { font-size: 0.7rem; color: var(--text-muted); }
	.sr-dist-btn { background: var(--bg-input); border: 1px solid var(--border); border-radius: 14px; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; cursor: pointer; color: var(--text-secondary); }
	.sr-dist-btn:hover { border-color: var(--accent); color: var(--accent-light); }
	.sr-desc { font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4; margin: 0; }
	.sr-link { font-size: 0.75rem; color: var(--accent-light); }
	.search-error { font-size: 0.78rem; color: var(--warning); padding: 8px 12px; background: rgba(255,192,72,0.08); border-radius: var(--radius-sm); }

	.distance-presets { display: flex; gap: 6px; flex-wrap: wrap; }
	.preset-btn { background: var(--bg-input); border: 1px solid var(--border); border-radius: 20px; color: var(--text-secondary); font-size: 0.78rem; font-weight: 600; padding: 5px 12px; cursor: pointer; }
	.preset-btn:hover { border-color: var(--accent); }
	.preset-btn.active { background: rgba(108,92,231,0.15); border-color: var(--accent); color: var(--accent-light); }

	.toggle-row { display: flex; gap: 8px; }
	.obj-btn { flex: 1; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 0.82rem; padding: 8px 12px; cursor: pointer; }
	.obj-btn:hover { border-color: var(--accent); }
	.obj-btn.active { background: rgba(108,92,231,0.12); border-color: var(--accent); color: var(--accent-light); }

	.btn-create { background: var(--accent); border: none; border-radius: var(--radius-md); color: white; font-size: 0.95rem; font-weight: 600; padding: 12px 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; }
	.btn-create:hover { background: var(--accent-light); }
	.btn-create:disabled { opacity: 0.4; cursor: not-allowed; }

	/* === PROGRAMME VIEW === */
	.race-tabs { display: flex; gap: 6px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
	.race-tab { background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; min-width: 120px; transition: all 0.2s; }
	.race-tab:hover { border-color: var(--accent); }
	.race-tab.active { border-color: var(--accent); background: rgba(99,102,241,0.1); }
	.rt-name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.rt-date { font-size: 0.68rem; color: var(--text-muted); }
	.rt-dist { font-size: 0.68rem; color: var(--accent); font-weight: 600; }
	.race-tab.add-tab { border-style: dashed; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.82rem; min-width: 80px; }
	.race-tab.add-tab:hover { color: var(--accent); border-color: var(--accent); }
	.btn-cancel-add { background: none; border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 0.8rem; padding: 5px 12px; cursor: pointer; margin-top: 8px; }
	.btn-cancel-add:hover { border-color: var(--accent); }
	.btn-sm.danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
	.btn-sm.danger:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; }
	.race-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px; }
	.race-header h1 { font-size: 1.3rem; font-weight: 700; margin-bottom: 6px; }
	.race-meta { display: flex; gap: 6px; flex-wrap: wrap; }
	.race-tag { background: var(--bg-input); border: 1px solid var(--border); border-radius: 20px; font-size: 0.72rem; font-weight: 600; padding: 2px 10px; color: var(--text-secondary); font-family: var(--font-mono); }
	.race-tag.accent { background: rgba(108,92,231,0.12); border-color: var(--accent); color: var(--accent-light); }
	.race-tag.goal { background: rgba(0,210,160,0.1); border-color: var(--success); color: var(--success); }
	.header-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
	.btn-sm { background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 0.78rem; padding: 5px 10px; cursor: pointer; text-decoration: none; }
	.btn-sm:hover { border-color: var(--accent); color: var(--text-primary); text-decoration: none; }
	.save-indicator { display: flex; align-items: center; }

	/* Profile bar */
	.profile-bar { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 10px 16px; margin-bottom: 12px; }
	.pb-fields { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; }
	.pb-field { display: flex; flex-direction: column; gap: 3px; }
	.pb-field label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.04em; }
	.pb-field input { background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.78rem; padding: 4px 8px; color: var(--text-primary); font-family: var(--font-mono); width: 80px; outline: none; }
	.pb-field input[type="date"] { width: 130px; font-family: var(--font-sans); }
	.pb-field input:focus { border-color: var(--accent); }
	.pb-input-unit { display: flex; align-items: center; gap: 4px; }
	.pb-input-unit span { font-size: 0.68rem; color: var(--text-muted); }

	/* Stats */
	.stats-bar { display: flex; align-items: center; gap: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 20px; margin-bottom: 12px; }
	.stat-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
	.stat-num { font-family: var(--font-mono); font-size: 1rem; font-weight: 700; }
	.stat-lbl { font-size: 0.65rem; color: var(--text-muted); }
	.stat-item.run .stat-num { color: var(--success); }
	.stat-item.ride .stat-num { color: #0984e3; }
	.stat-item.both .stat-num { color: var(--accent-light); }
	.stat-item.none .stat-num { color: var(--text-muted); }
	.stat-sep { width: 1px; height: 24px; background: var(--border); }

	/* Actions row */
	.actions-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
	.quick-actions { display: flex; gap: 6px; flex-wrap: wrap; }
	.qa-btn { background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 0.7rem; padding: 4px 8px; cursor: pointer; }
	.qa-btn:hover { border-color: var(--accent); color: var(--text-primary); }

	.btn-ai { background: linear-gradient(135deg, #6c5ce7, #a855f7); border: none; border-radius: var(--radius-md); color: white; font-size: 0.85rem; font-weight: 600; padding: 10px 18px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: opacity 0.15s; }
	.btn-ai:hover { opacity: 0.9; }
	.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }

	.coaching-error { font-size: 0.8rem; color: var(--danger); padding: 8px 12px; background: rgba(255,107,107,0.08); border-radius: var(--radius-sm); margin-bottom: 12px; }
	.coaching-summary { background: rgba(108,92,231,0.06); border: 1px solid rgba(108,92,231,0.15); border-radius: var(--radius-lg); padding: 14px 18px; margin-bottom: 16px; }
	.cs-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
	.cs-header strong { font-size: 0.88rem; }
	.cs-tag { background: rgba(108,92,231,0.15); border-radius: 12px; font-size: 0.68rem; font-weight: 600; padding: 2px 8px; color: var(--accent-light); }
	.coaching-summary p { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 0; }

	/* === VERTICAL CALENDAR === */
	.v-calendar { display: flex; flex-direction: column; }

	.week-separator { padding: 12px 0 6px; border-top: 2px solid var(--border); margin-top: 4px; }
	.week-separator span { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }

	.v-day { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); transition: background 0.1s; }
	.v-day:hover { background: var(--bg-card-hover); }
	.v-day.today { background: rgba(108,92,231,0.06); }
	.v-day.race-day { background: rgba(0,210,160,0.06); }
	.v-day.rest { opacity: 0.55; }
	.v-day.weekend { background: rgba(255,255,255,0.015); }

	.v-date { display: flex; align-items: center; gap: 6px; width: 110px; flex-shrink: 0; }
	.v-dayname { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); width: 26px; text-transform: capitalize; }
	.v-daynum { font-size: 0.82rem; font-weight: 700; color: var(--text-primary); width: 24px; text-align: center; }
	.v-daynum.today-ring { background: var(--accent); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; }
	.v-month { font-size: 0.65rem; color: var(--text-muted); }

	.v-toggles { display: flex; gap: 3px; flex-shrink: 0; width: 56px; }
	.v-tog { background: none; border: 1.5px solid var(--border); border-radius: 4px; font-size: 0.75rem; padding: 2px 4px; cursor: pointer; opacity: 0.3; filter: grayscale(100%); transition: all 0.15s; line-height: 1; }
	.v-tog:hover { opacity: 0.7; filter: grayscale(0%); }
	.v-tog.on { opacity: 1; filter: grayscale(0%); border-color: var(--accent); }

	.v-race-badge { background: rgba(0,210,160,0.15); color: var(--success); font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 12px; flex-shrink: 0; }
	.v-race-badge.other { background: rgba(168,85,247,0.12); color: #a855f7; font-size: 0.7rem; font-weight: 600; }
	.v-day.other-race-day { background: rgba(168,85,247,0.06); border-left: 2px solid #a855f7; }

	.v-plan { flex: 1; min-width: 0; }

	.plan-card { background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--radius-md); padding: 8px 12px; }
	.plan-card.other-plan { opacity: 0.7; border-style: dashed; border-left-style: solid; }
	.plan-from { font-size: 0.65rem; color: #a855f7; font-style: italic; }
	.plan-top { display: flex; align-items: center; gap: 6px; }
	.plan-sport { font-size: 0.85rem; }
	.plan-title { font-size: 0.82rem; font-weight: 600; flex: 1; }
	.plan-type { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
	.btn-garmin { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.72rem; padding: 1px 5px; cursor: pointer; margin-left: auto; opacity: 0.6; flex-shrink: 0; }
	.btn-garmin:hover { opacity: 1; border-color: var(--accent); }
	.plan-details { display: flex; gap: 10px; margin-top: 4px; font-size: 0.72rem; color: var(--text-secondary); font-family: var(--font-mono); }
	.plan-desc { font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin: 4px 0 0; }

	.plan-rest { font-size: 0.78rem; color: var(--text-muted); }
	.plan-empty { font-size: 0.78rem; color: var(--text-muted); }

	/* Mobile */
	@media (max-width: 640px) {
		.field-row { flex-direction: column; gap: 12px; }
		.race-header { flex-direction: column; }
		.pb-fields { gap: 8px; }
		.stats-bar { flex-wrap: wrap; gap: 10px; padding: 10px 14px; }
		.stat-sep { display: none; }
		.actions-row { flex-direction: column; align-items: stretch; }
		.race-tabs { gap: 4px; }
		.race-tab { min-width: 100px; padding: 6px 10px; }
		.v-day { flex-wrap: wrap; padding: 6px 8px; gap: 6px; }
		.v-date { width: 90px; }
		.v-plan { width: 100%; }
	}

	/* Withings */
	.withings-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
	.withings-status { display: flex; align-items: center; gap: 10px; font-size: 0.82rem; flex-wrap: wrap; }
	.withings-status.connected { color: var(--success); }
	.ws-val { background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; font-size: 0.72rem; font-weight: 600; padding: 2px 8px; color: var(--text-secondary); font-family: var(--font-mono); }
	.btn-withings { background: #00b4d8; border: none; border-radius: var(--radius-md); color: white; font-size: 0.82rem; font-weight: 600; padding: 8px 16px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
	.btn-withings:hover { opacity: 0.9; text-decoration: none; }

	.pb-withings { display: flex; gap: 8px; align-items: center; margin-left: 8px; }
	.wb-val { font-size: 0.72rem; font-family: var(--font-mono); color: var(--text-secondary); }
	.wb-lbl { font-size: 0.62rem; color: var(--text-muted); text-transform: uppercase; }
	.pb-connect { font-size: 0.72rem; color: #00b4d8; text-decoration: none; padding: 3px 8px; border: 1px solid #00b4d8; border-radius: var(--radius-sm); margin-left: 8px; white-space: nowrap; }
	.pb-connect:hover { background: rgba(0,180,216,0.1); text-decoration: none; }

	.btn-sync { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.75rem; padding: 3px 6px; cursor: pointer; line-height: 1; }
	.btn-sync:hover { border-color: var(--accent); }
	.btn-sync:disabled { opacity: 0.4; cursor: not-allowed; }
	.btn-sync-sm { background: none; border: none; font-size: 0.7rem; padding: 2px; cursor: pointer; opacity: 0.6; }
	.btn-sync-sm:hover { opacity: 1; }
	.btn-sync-sm:disabled { opacity: 0.3; cursor: not-allowed; }

	/* Analysis Card */
	.analysis-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; }
	.an-header { margin-bottom: 16px; }
	.an-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
	.an-title strong { font-size: 1rem; }
	.an-badge { font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
	.an-badge.red { background: rgba(239,68,68,0.15); color: #ef4444; }
	.an-badge.orange { background: rgba(249,115,22,0.15); color: #f97316; }
	.an-badge.yellow { background: rgba(234,179,8,0.15); color: #eab308; }
	.an-badge.green { background: rgba(34,197,94,0.15); color: #22c55e; }
	.an-badge.purple { background: rgba(168,85,247,0.15); color: #a855f7; }
	.an-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
	.an-score { font-family: var(--font-mono); font-size: 1.2rem; font-weight: 800; color: var(--accent); }
	.an-time { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); background: var(--bg-input); padding: 3px 10px; border-radius: 12px; }
	.an-date { font-size: 0.7rem; color: var(--text-muted); }
	.an-body { line-height: 1.65; color: var(--text-secondary); font-size: 0.88rem; }
	.an-body p { margin-bottom: 12px; }
	.an-body p:last-child { margin-bottom: 0; }
	.an-refresh { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--text-muted); padding: 5px 12px; cursor: pointer; margin-top: 12px; display: inline-flex; align-items: center; gap: 4px; }
	.an-refresh:hover { border-color: var(--accent); color: var(--text-primary); }
	.an-refresh:disabled { opacity: 0.4; cursor: not-allowed; }
	.btn-analysis { background: linear-gradient(135deg, #8b5cf6, #06b6d4); border: none; border-radius: var(--radius-md); color: white; font-size: 0.9rem; font-weight: 600; padding: 12px 24px; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
	.btn-analysis:hover { opacity: 0.9; }
	.btn-analysis:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Prediction */
	.prediction-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; }
	.pred-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 0.95rem; }
	.pred-confidence { font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
	.pred-confidence.green { background: rgba(34,197,94,0.15); color: #22c55e; }
	.pred-confidence.orange { background: rgba(234,179,8,0.15); color: #eab308; }
	.pred-confidence.red { background: rgba(239,68,68,0.15); color: #ef4444; }
	.pred-times { display: flex; gap: 10px; margin-bottom: 14px; }
	.pred-section-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin: 12px 0 6px; }
	.pred-time { flex: 1; padding: 12px; border-radius: var(--radius-md); text-align: center; }
	.pred-time.optimistic { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); }
	.pred-time.realistic { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); }
	.pred-time.conservative { background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2); }
	.pred-label { display: block; font-size: 0.7rem; color: var(--text-muted); margin-bottom: 4px; }
	.pred-value { font-family: var(--font-mono); font-size: 1.2rem; font-weight: 700; }
	.pred-time.optimistic .pred-value { color: #22c55e; }
	.pred-time.realistic .pred-value { color: #3b82f6; }
	.pred-time.conservative .pred-value { color: #eab308; }
	.pred-pace { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px; text-align: center; font-family: var(--font-mono); }
	.pred-analysis { font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); }
	.pred-analysis p { margin: 0 0 8px; }
	.pred-strategy { color: var(--accent-light); font-style: italic; }
	.btn-prediction { background: linear-gradient(135deg, #f97316, #eab308); border: none; border-radius: var(--radius-md); color: white; font-size: 0.9rem; font-weight: 600; padding: 12px 24px; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
	.btn-prediction:hover { opacity: 0.9; }
	.btn-prediction:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Estimate objective */
	.objective-row { display: flex; gap: 8px; align-items: center; }
	.objective-row input { flex: 1; }
	.btn-estimate { padding: 8px 14px; border: 1px solid var(--accent); border-radius: var(--radius-md); background: var(--accent-glow); color: var(--accent-light); font-weight: 600; font-size: 0.82rem; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
	.btn-estimate:hover { background: var(--accent); color: white; }
	.btn-estimate:disabled { opacity: 0.5; cursor: not-allowed; }
	.mini-predictions { display: flex; gap: 6px; margin-top: 6px; }
	.mini-pred { padding: 4px 10px; border: 1px solid var(--border); border-radius: 20px; background: transparent; color: var(--text-secondary); font-size: 0.75rem; font-family: var(--font-mono); cursor: pointer; transition: all 0.15s; }
	.mini-pred:hover { border-color: var(--accent); color: var(--accent-light); }
	.mini-pred.selected { border-color: var(--accent); background: var(--accent-glow); color: var(--accent-light); font-weight: 600; }
	.pred-hint { font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; margin-top: 8px; font-style: italic; }

	/* Estimate tag in header */
	.estimate-tag { cursor: pointer; background: rgba(249,115,22,0.12); color: #f97316; border: 1px solid rgba(249,115,22,0.3); transition: all 0.15s; }
	.estimate-tag:hover { background: rgba(249,115,22,0.25); }
	.estimate-tag:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
