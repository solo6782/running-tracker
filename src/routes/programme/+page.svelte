<script>
	import { onMount } from 'svelte';

	// === STATE ===
	let loading = true;
	let saving = false;
	let saveTimeout;

	// Programme
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

	// === LIFECYCLE ===
	onMount(async () => {
		try {
			const [progRes, profRes] = await Promise.all([
				fetch('/api/programme'),
				fetch('/api/profile')
			]);
			const progData = await progRes.json();
			const profData = await profRes.json();

			if (progData.programme) loadProgramme(progData.programme);
			if (profData.profile) loadProfile(profData.profile);

			// Check Withings connection
			fetchWithings();

			// Check URL params for Withings redirect result
			const params = new URLSearchParams(window.location.search);
			if (params.get('withings') === 'connected') {
				fetchWithings(true); // force sync on first connect
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

	function generateDays(raceDateStr) {
		if (!raceDateStr) return [];
		const today = new Date(); today.setHours(0,0,0,0);
		const end = new Date(raceDateStr); end.setHours(0,0,0,0);
		if (end <= today) return [];

		const days = [];
		let current = new Date(today);
		while (current <= end) {
			const dateStr = current.toISOString().split('T')[0];
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
			if (data.programme) { programmeId = data.programme.id; programCreated = true; }
		} catch (err) { console.error(err); }
		finally { saving = false; }
		// Save profile too
		await saveProfile();
	}

	async function resetProgram() {
		if (programmeId) await fetch(`/api/programme?id=${programmeId}`, { method: 'DELETE' });
		programCreated = false; programmeId = null; availability = {};
		raceName = ''; raceDate = ''; raceDistance = '';
		raceLocation = ''; raceElevation = null; raceProfile = ''; raceUrl = '';
		objectiveType = 'finish'; objectiveTime = '';
		searchResult = null; coachingSummary = ''; coachingLevel = '';
	}

	function setAllDays(type, value) {
		for (const day of calendarDays) {
			if (!day.isRaceDay) {
				if (!availability[day.date]) availability[day.date] = { run: false, ride: false };
				availability[day.date][type] = value;
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
			}
		} catch (err) { coachingError = err.message; }
		finally { generating = false; }
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

{:else if !programCreated}
<!-- ===== SETUP ===== -->
<div class="setup-section">
	<div class="setup-header">
		<span class="setup-icon">🎯</span>
		<h1>Nouveau programme</h1>
		<p class="setup-sub">Configure ta course et ton profil</p>
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
				<input type="text" bind:value={objectiveTime} placeholder="Ex: 1:45:00" />
				{#if objectiveTime && raceDistance}<span class="field-hint">≈ {computePace(objectiveTime, raceDistance)} /km</span>{/if}
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
		</div>
	</div>
	<div class="header-actions">
		<button class="btn-sm" on:click={resetProgram}>✏️ Modifier</button>
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

<!-- VERTICAL CALENDAR -->
<div class="v-calendar">
	{#each calendarDays as day, i}
		{@const a = availability[day.date]}
		{@const plan = a?.plan}
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
			class:weekend={day.isWeekend}
			class:has-plan={!!plan}
			class:rest={a && !a.run && !a.ride}
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
						</div>
						<div class="plan-details">
							{#if plan.duration_min}<span>⏱ {plan.duration_min}min</span>{/if}
							{#if plan.distance_km}<span>📏 {plan.distance_km}km</span>{/if}
						</div>
						{#if plan.description}
							<p class="plan-desc">{plan.description}</p>
						{/if}
					</div>
				{:else if day.isRaceDay}
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

	.v-plan { flex: 1; min-width: 0; }

	.plan-card { background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: var(--radius-md); padding: 8px 12px; }
	.plan-top { display: flex; align-items: center; gap: 6px; }
	.plan-sport { font-size: 0.85rem; }
	.plan-title { font-size: 0.82rem; font-weight: 600; flex: 1; }
	.plan-type { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
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
</style>
