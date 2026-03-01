<script>
	import { onMount } from 'svelte';

	// Race info
	let raceName = '';
	let raceDate = '';
	let raceDistance = '';
	let raceLocation = '';
	let raceElevation = null;
	let raceProfile = '';
	let raceUrl = '';
	let objectiveType = 'finish'; // 'finish' or 'time'
	let objectiveTime = ''; // e.g. "1:45:00"
	let programCreated = false;

	// Search state
	let searching = false;
	let searchResult = null;
	let searchError = '';

	async function searchRace() {
		if (!raceName || raceName.length < 3) return;
		searching = true;
		searchError = '';
		searchResult = null;

		try {
			const res = await fetch('/api/race-search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: raceName })
			});
			const data = await res.json();

			if (data.error) {
				searchError = data.error;
			} else if (data.found) {
				searchResult = data;
				// Auto-fill fields
				if (data.name) raceName = data.name;
				if (data.date) raceDate = data.date;
				if (data.distance_km) raceDistance = data.distance_km;
				if (data.location) raceLocation = data.location;
				if (data.elevation_gain) raceElevation = data.elevation_gain;
				if (data.profile) raceProfile = data.profile;
				if (data.url) raceUrl = data.url;
			} else {
				searchError = 'Course non trouvée. Tu peux remplir les infos manuellement.';
			}
		} catch (err) {
			searchError = `Erreur de recherche: ${err.message}`;
		} finally {
			searching = false;
		}
	}

	function dismissSearch() {
		searchResult = null;
		searchError = '';
	}

	// Calendar data: { 'YYYY-MM-DD': { run: bool, ride: bool } }
	let availability = {};

	// Generate calendar weeks from today to race date
	$: calendarWeeks = generateCalendar(raceDate);
	$: daysUntilRace = raceDate ? Math.ceil((new Date(raceDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
	$: weeksUntilRace = Math.ceil(daysUntilRace / 7);

	// Stats
	$: totalDays = Object.keys(availability).length;
	$: runDays = Object.values(availability).filter(d => d.run).length;
	$: rideDays = Object.values(availability).filter(d => d.ride).length;
	$: bothDays = Object.values(availability).filter(d => d.run && d.ride).length;
	$: nothingDays = Object.values(availability).filter(d => !d.run && !d.ride).length;

	function generateCalendar(raceDateStr) {
		if (!raceDateStr) return [];

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const end = new Date(raceDateStr);
		end.setHours(0, 0, 0, 0);

		if (end <= today) return [];

		// Start from Monday of current week
		const start = new Date(today);
		const dayOfWeek = start.getDay();
		const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
		start.setDate(start.getDate() + diff);

		// End on Sunday after race date
		const calEnd = new Date(end);
		const endDow = calEnd.getDay();
		if (endDow !== 0) {
			calEnd.setDate(calEnd.getDate() + (7 - endDow));
		}

		const weeks = [];
		let current = new Date(start);

		while (current <= calEnd) {
			const week = [];
			for (let i = 0; i < 7; i++) {
				const dateStr = current.toISOString().split('T')[0];
				const isToday = current.getTime() === today.getTime();
				const isRaceDay = current.getTime() === end.getTime();
				const isPast = current < today;
				const isAfterRace = current > end;

				week.push({
					date: dateStr,
					day: current.getDate(),
					month: current.getMonth(),
					isToday,
					isRaceDay,
					isPast,
					isAfterRace,
					isTrainingDay: !isPast && !isRaceDay && !isAfterRace
				});

				current.setDate(current.getDate() + 1);
			}
			weeks.push(week);
		}

		return weeks;
	}

	function toggleAvailability(dateStr, type) {
		if (!availability[dateStr]) {
			availability[dateStr] = { run: false, ride: false };
		}
		availability[dateStr][type] = !availability[dateStr][type];
		availability = availability; // trigger reactivity
	}

	function createProgram() {
		if (!raceName || !raceDate || !raceDistance) return;
		programCreated = true;

		// Initialize all training days with both options available
		for (const week of calendarWeeks) {
			for (const day of week) {
				if (day.isTrainingDay && !availability[day.date]) {
					availability[day.date] = { run: true, ride: true };
				}
			}
		}
		availability = availability;
	}

	function resetProgram() {
		programCreated = false;
		availability = {};
	}

	// Quick fill helpers
	function setAllDays(type, value) {
		for (const week of calendarWeeks) {
			for (const day of week) {
				if (day.isTrainingDay) {
					if (!availability[day.date]) {
						availability[day.date] = { run: false, ride: false };
					}
					availability[day.date][type] = value;
				}
			}
		}
		availability = availability;
	}

	// Month labels
	const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

	function getWeekMonthLabel(week) {
		// Return month label if this week contains the 1st of a month
		for (const day of week) {
			if (day.day <= 7 && day.day >= 1) {
				return monthNames[day.month];
			}
		}
		return null;
	}

	// Distance presets
	const distances = [
		{ label: '5K', value: 5 },
		{ label: '10K', value: 10 },
		{ label: 'Semi', value: 21.1 },
		{ label: 'Marathon', value: 42.195 },
		{ label: 'Ultra', value: 0 }
	];
</script>

<svelte:head>
	<title>Programme Course — Running Tracker</title>
</svelte:head>

<div class="page">

	{#if !programCreated}
	<!-- ===== SETUP FORM ===== -->
	<div class="setup-section">
		<div class="setup-header">
			<span class="setup-icon">🎯</span>
			<h1>Nouveau programme</h1>
			<p class="setup-sub">Configure ton objectif de course</p>
		</div>

		<div class="form-card">
			<!-- Race Name + Search -->
			<div class="field">
				<label for="race-name">Nom de la course</label>
				<div class="search-row">
					<input id="race-name" type="text" bind:value={raceName} placeholder="Ex: Marathon de Paris"
						on:keydown={(e) => e.key === 'Enter' && searchRace()} />
					<button class="btn-search" on:click={searchRace} disabled={searching || raceName.length < 3}>
						{#if searching}
							<span class="spinner"></span>
						{:else}
							🔍
						{/if}
					</button>
				</div>
				<span class="field-hint-subtle">Tape le nom et clique 🔍 pour remplir automatiquement</span>
			</div>

			<!-- Search Result Card -->
			{#if searchResult}
				<div class="search-result">
					<div class="sr-header">
						<span class="sr-icon">✅</span>
						<strong>{searchResult.name}</strong>
						<button class="sr-dismiss" on:click={dismissSearch}>✕</button>
					</div>
					<div class="sr-details">
						{#if searchResult.location}
							<span class="sr-tag">📍 {searchResult.location}</span>
						{/if}
						{#if searchResult.date}
							<span class="sr-tag">📅 {searchResult.date}</span>
						{/if}
						{#if searchResult.distance_km}
							<span class="sr-tag">📏 {searchResult.distance_km}km</span>
						{/if}
						{#if searchResult.elevation_gain}
							<span class="sr-tag">⛰️ D+{searchResult.elevation_gain}m</span>
						{/if}
						{#if searchResult.profile}
							<span class="sr-tag">🗺️ {searchResult.profile}</span>
						{/if}
					</div>
					{#if searchResult.distances && searchResult.distances.length > 1}
						<div class="sr-distances">
							<span class="sr-dist-label">Distances proposées :</span>
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
					{#if searchResult.description}
						<p class="sr-desc">{searchResult.description}</p>
					{/if}
					{#if searchResult.url}
						<a href={searchResult.url} target="_blank" rel="noopener" class="sr-link">🔗 Site officiel</a>
					{/if}
				</div>
			{/if}

			{#if searchError}
				<div class="search-error">{searchError}</div>
			{/if}

			<!-- Race Date -->
			<div class="field">
				<label for="race-date">Date de la course</label>
				<input id="race-date" type="date" bind:value={raceDate} min={new Date().toISOString().split('T')[0]} />
				{#if daysUntilRace > 0}
					<span class="field-hint">Dans {daysUntilRace} jours ({weeksUntilRace} semaines)</span>
				{/if}
			</div>

			<!-- Distance -->
			<div class="field">
				<label>Distance</label>
				<div class="distance-presets">
					{#each distances as d}
						<button
							class="preset-btn"
							class:active={d.value > 0 && parseFloat(raceDistance) === d.value}
							on:click={() => raceDistance = d.value > 0 ? d.value : ''}
						>
							{d.label}
						</button>
					{/each}
				</div>
				<div class="distance-input-row">
					<input type="number" bind:value={raceDistance} placeholder="Distance" step="0.1" min="0" />
					<span class="unit">km</span>
				</div>
			</div>

			<!-- Objective -->
			<div class="field">
				<label>Objectif</label>
				<div class="objective-toggle">
					<button
						class="obj-btn"
						class:active={objectiveType === 'finish'}
						on:click={() => objectiveType = 'finish'}
					>
						🏁 Juste finir
					</button>
					<button
						class="obj-btn"
						class:active={objectiveType === 'time'}
						on:click={() => objectiveType = 'time'}
					>
						⏱️ Temps cible
					</button>
				</div>
				{#if objectiveType === 'time'}
					<input
						type="text"
						bind:value={objectiveTime}
						placeholder="Ex: 1:45:00"
						class="time-input"
					/>
					{#if objectiveTime && raceDistance}
						<span class="field-hint">
							≈ {computePace(objectiveTime, raceDistance)} /km
						</span>
					{/if}
				{/if}
			</div>

			<button
				class="btn-create"
				on:click={createProgram}
				disabled={!raceName || !raceDate || !raceDistance}
			>
				Créer le programme →
			</button>
		</div>
	</div>

	{:else}
	<!-- ===== PROGRAM VIEW ===== -->

	<!-- Race Header -->
	<div class="race-header">
		<div class="race-info">
			<h1>{raceName}</h1>
			<div class="race-meta">
				<span class="race-tag">{raceDistance}km</span>
				{#if raceLocation}
					<span class="race-tag">📍 {raceLocation}</span>
				{/if}
				<span class="race-tag">{formatRaceDate(raceDate)}</span>
				<span class="race-tag accent">J-{daysUntilRace}</span>
				{#if raceElevation}
					<span class="race-tag">⛰️ D+{raceElevation}m</span>
				{/if}
				{#if raceProfile}
					<span class="race-tag">{raceProfile}</span>
				{/if}
				{#if objectiveType === 'time' && objectiveTime}
					<span class="race-tag goal">🎯 {objectiveTime}</span>
				{:else}
					<span class="race-tag goal">🏁 Finir</span>
				{/if}
			</div>
		</div>
		<button class="btn-reset" on:click={resetProgram}>✏️ Modifier</button>
		{#if raceUrl}
			<a href={raceUrl} target="_blank" rel="noopener" class="btn-ext">🔗</a>
		{/if}
	</div>

	<!-- Availability Stats -->
	<div class="stats-bar">
		<div class="stat-item">
			<span class="stat-num">{daysUntilRace}</span>
			<span class="stat-lbl">jours</span>
		</div>
		<div class="stat-sep"></div>
		<div class="stat-item run">
			<span class="stat-num">{runDays}</span>
			<span class="stat-lbl">🏃 run</span>
		</div>
		<div class="stat-item ride">
			<span class="stat-num">{rideDays}</span>
			<span class="stat-lbl">🚴 vélo</span>
		</div>
		<div class="stat-item both">
			<span class="stat-num">{bothDays}</span>
			<span class="stat-lbl">les 2</span>
		</div>
		<div class="stat-item none">
			<span class="stat-num">{nothingDays}</span>
			<span class="stat-lbl">repos</span>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="quick-actions">
		<span class="qa-label">Remplissage rapide :</span>
		<button class="qa-btn" on:click={() => setAllDays('run', true)}>✅ Tout run</button>
		<button class="qa-btn" on:click={() => setAllDays('ride', true)}>✅ Tout vélo</button>
		<button class="qa-btn" on:click={() => setAllDays('run', false)}>❌ Aucun run</button>
		<button class="qa-btn" on:click={() => setAllDays('ride', false)}>❌ Aucun vélo</button>
	</div>

	<!-- Legend -->
	<div class="legend">
		<div class="legend-item"><span class="leg-dot run"></span> Run possible</div>
		<div class="legend-item"><span class="leg-dot ride"></span> Vélo possible</div>
		<div class="legend-item"><span class="leg-dot both"></span> Les 2</div>
		<div class="legend-item"><span class="leg-dot none"></span> Repos / indispo</div>
	</div>

	<!-- Calendar -->
	<div class="calendar">
		<!-- Day headers -->
		<div class="cal-header">
			<div class="cal-month-col"></div>
			{#each ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as dayName}
				<div class="cal-day-name">{dayName}</div>
			{/each}
		</div>

		<!-- Weeks -->
		{#each calendarWeeks as week, wi}
			{@const monthLabel = getWeekMonthLabel(week)}
			<div class="cal-week">
				<div class="cal-month-col">
					{#if monthLabel}
						<span class="month-label">{monthLabel}</span>
					{/if}
				</div>
				{#each week as day}
					<div
						class="cal-cell"
						class:today={day.isToday}
						class:race-day={day.isRaceDay}
						class:past={day.isPast}
						class:disabled={day.isAfterRace}
						class:has-run={availability[day.date]?.run}
						class:has-ride={availability[day.date]?.ride}
						class:has-both={availability[day.date]?.run && availability[day.date]?.ride}
						class:has-nothing={day.isTrainingDay && availability[day.date] && !availability[day.date]?.run && !availability[day.date]?.ride}
					>
						<span class="cell-day" class:today-ring={day.isToday}>{day.day}</span>

						{#if day.isRaceDay}
							<span class="cell-race">🏁</span>
						{:else if day.isTrainingDay}
							<div class="cell-toggles">
								<button
									class="toggle-btn run"
									class:on={availability[day.date]?.run}
									on:click={() => toggleAvailability(day.date, 'run')}
									title="Run"
								>🏃</button>
								<button
									class="toggle-btn ride"
									class:on={availability[day.date]?.ride}
									on:click={() => toggleAvailability(day.date, 'ride')}
									title="Vélo"
								>🚴</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<!-- Future AI Section Placeholder -->
	<div class="ai-placeholder">
		<span class="ai-icon">🤖</span>
		<div class="ai-text">
			<strong>Coaching IA</strong>
			<p>Bientôt disponible — L'IA analysera tes disponibilités et ton historique pour générer un plan d'entraînement personnalisé.</p>
		</div>
	</div>

	{/if}
</div>

<script context="module">
	function formatRaceDate(dateStr) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
		const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
		return `${days[d.getDay()]}. ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
	}

	function computePace(timeStr, distanceKm) {
		if (!timeStr || !distanceKm) return '';
		const parts = timeStr.split(':').map(Number);
		let totalSeconds;
		if (parts.length === 3) {
			totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
		} else if (parts.length === 2) {
			totalSeconds = parts[0] * 60 + parts[1];
		} else {
			return '';
		}
		const paceSeconds = totalSeconds / distanceKm;
		const paceMin = Math.floor(paceSeconds / 60);
		const paceSec = Math.round(paceSeconds % 60);
		return `${paceMin}:${String(paceSec).padStart(2, '0')}`;
	}
</script>

<style>
	.page {
		max-width: 900px;
		margin: 0 auto;
		padding: 24px 16px 60px;
	}

	/* ===== SETUP FORM ===== */
	.setup-section {
		max-width: 520px;
		margin: 40px auto;
	}
	.setup-header {
		text-align: center;
		margin-bottom: 32px;
	}
	.setup-icon { font-size: 2.5rem; display: block; margin-bottom: 12px; }
	.setup-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.setup-sub {
		color: var(--text-muted);
		font-size: 0.88rem;
		margin-top: 4px;
	}

	.form-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 28px 24px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field label {
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}
	.field input[type="text"],
	.field input[type="date"],
	.field input[type="number"] {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.92rem;
		padding: 10px 14px;
		outline: none;
		transition: border-color 0.15s;
	}
	.field input:focus { border-color: var(--accent); }
	.field-hint {
		font-size: 0.75rem;
		color: var(--accent-light);
		font-family: var(--font-mono);
	}
	.field-hint-subtle {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	/* Search row */
	.search-row {
		display: flex;
		gap: 8px;
	}
	.search-row input { flex: 1; }
	.btn-search {
		background: var(--accent);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		font-size: 1rem;
		padding: 0 14px;
		cursor: pointer;
		transition: background 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
	}
	.btn-search:hover { background: var(--accent-light); }
	.btn-search:disabled { opacity: 0.4; cursor: not-allowed; }

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255,255,255,0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Search result card */
	.search-result {
		background: rgba(0, 210, 160, 0.06);
		border: 1px solid rgba(0, 210, 160, 0.2);
		border-radius: var(--radius-md);
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.sr-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.sr-header strong {
		flex: 1;
		font-size: 0.92rem;
	}
	.sr-icon { font-size: 1rem; }
	.sr-dismiss {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.85rem;
		padding: 2px 6px;
	}
	.sr-dismiss:hover { color: var(--text-primary); }

	.sr-details {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.sr-tag {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 16px;
		font-size: 0.73rem;
		padding: 3px 10px;
		color: var(--text-secondary);
	}

	.sr-distances {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.sr-dist-label {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.sr-dist-btn {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 14px;
		font-size: 0.72rem;
		font-weight: 600;
		padding: 3px 10px;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s;
	}
	.sr-dist-btn:hover {
		border-color: var(--accent);
		color: var(--accent-light);
	}

	.sr-desc {
		font-size: 0.78rem;
		color: var(--text-secondary);
		line-height: 1.5;
		margin: 0;
	}
	.sr-link {
		font-size: 0.78rem;
		color: var(--accent-light);
	}

	.search-error {
		font-size: 0.8rem;
		color: var(--warning);
		padding: 8px 12px;
		background: rgba(255, 192, 72, 0.08);
		border-radius: var(--radius-sm);
	}

	.distance-presets {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.preset-btn {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 20px;
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		padding: 6px 14px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.preset-btn:hover { border-color: var(--accent); color: var(--text-primary); }
	.preset-btn.active {
		background: rgba(108, 92, 231, 0.15);
		border-color: var(--accent);
		color: var(--accent-light);
	}

	.distance-input-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.distance-input-row input { flex: 1; }
	.unit {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-family: var(--font-mono);
	}

	.objective-toggle {
		display: flex;
		gap: 8px;
	}
	.obj-btn {
		flex: 1;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-weight: 500;
		padding: 10px 14px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.obj-btn:hover { border-color: var(--accent); }
	.obj-btn.active {
		background: rgba(108, 92, 231, 0.12);
		border-color: var(--accent);
		color: var(--accent-light);
	}

	.time-input { margin-top: 6px; }

	.btn-create {
		background: var(--accent);
		border: none;
		border-radius: var(--radius-md);
		color: white;
		font-size: 0.95rem;
		font-weight: 600;
		padding: 12px 20px;
		cursor: pointer;
		transition: background 0.15s;
		margin-top: 4px;
	}
	.btn-create:hover { background: var(--accent-light); }
	.btn-create:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ===== PROGRAM VIEW ===== */
	.race-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
		gap: 16px;
	}
	.race-header h1 {
		font-size: 1.4rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-bottom: 8px;
	}
	.race-meta {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.race-tag {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 3px 10px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}
	.race-tag.accent {
		background: rgba(108, 92, 231, 0.12);
		border-color: var(--accent);
		color: var(--accent-light);
	}
	.race-tag.goal {
		background: rgba(0, 210, 160, 0.1);
		border-color: var(--success);
		color: var(--success);
	}

	.btn-reset {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.8rem;
		padding: 6px 12px;
		cursor: pointer;
		flex-shrink: 0;
	}
	.btn-reset:hover { border-color: var(--accent); color: var(--text-primary); }
	.btn-ext {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: 0.85rem;
		padding: 6px 10px;
		text-decoration: none;
		flex-shrink: 0;
	}
	.btn-ext:hover { border-color: var(--accent); text-decoration: none; }

	/* Stats bar */
	.stats-bar {
		display: flex;
		align-items: center;
		gap: 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 14px 20px;
		margin-bottom: 16px;
	}
	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.stat-num {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		font-weight: 700;
	}
	.stat-lbl {
		font-size: 0.68rem;
		color: var(--text-muted);
	}
	.stat-item.run .stat-num { color: var(--success); }
	.stat-item.ride .stat-num { color: #0984e3; }
	.stat-item.both .stat-num { color: var(--accent-light); }
	.stat-item.none .stat-num { color: var(--text-muted); }
	.stat-sep {
		width: 1px;
		height: 28px;
		background: var(--border);
	}

	/* Quick actions */
	.quick-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}
	.qa-label {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.qa-btn {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.72rem;
		padding: 4px 8px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.qa-btn:hover { border-color: var(--accent); color: var(--text-primary); }

	/* Legend */
	.legend {
		display: flex;
		gap: 16px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
	.leg-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.leg-dot.run { background: var(--success); }
	.leg-dot.ride { background: #0984e3; }
	.leg-dot.both { background: var(--accent); }
	.leg-dot.none { background: var(--border); }

	/* ===== CALENDAR ===== */
	.calendar {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.cal-header {
		display: grid;
		grid-template-columns: 48px repeat(7, 1fr);
		border-bottom: 1px solid var(--border);
		background: var(--bg-secondary);
	}
	.cal-month-col {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.cal-day-name {
		text-align: center;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		padding: 8px 0;
	}

	.cal-week {
		display: grid;
		grid-template-columns: 48px repeat(7, 1fr);
		border-bottom: 1px solid var(--border);
	}
	.cal-week:last-child { border-bottom: none; }

	.month-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--accent-light);
		letter-spacing: 0.04em;
	}

	.cal-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 2px;
		min-height: 60px;
		border-right: 1px solid rgba(42, 42, 58, 0.3);
		transition: background 0.1s;
		position: relative;
	}
	.cal-cell:last-child { border-right: none; }

	.cal-cell.past {
		opacity: 0.3;
	}
	.cal-cell.disabled {
		opacity: 0.15;
	}
	.cal-cell.today {
		background: rgba(108, 92, 231, 0.06);
	}
	.cal-cell.race-day {
		background: rgba(0, 210, 160, 0.08);
	}

	/* Color indicator strip at bottom */
	.cal-cell.has-run:not(.has-ride) { border-bottom: 3px solid var(--success); }
	.cal-cell.has-ride:not(.has-run) { border-bottom: 3px solid #0984e3; }
	.cal-cell.has-both { border-bottom: 3px solid var(--accent); }
	.cal-cell.has-nothing { border-bottom: 3px solid var(--border); }

	.cell-day {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}
	.cell-day.today-ring {
		background: var(--accent);
		color: white;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
	}

	.cell-race {
		font-size: 1.1rem;
	}

	.cell-toggles {
		display: flex;
		gap: 2px;
	}

	.toggle-btn {
		background: none;
		border: 1.5px solid var(--border);
		border-radius: 4px;
		font-size: 0.7rem;
		padding: 2px 3px;
		cursor: pointer;
		opacity: 0.3;
		filter: grayscale(100%);
		transition: all 0.15s;
		line-height: 1;
	}
	.toggle-btn:hover {
		opacity: 0.7;
		filter: grayscale(0%);
	}
	.toggle-btn.on {
		opacity: 1;
		filter: grayscale(0%);
	}
	.toggle-btn.run.on {
		border-color: var(--success);
		background: rgba(0, 210, 160, 0.12);
	}
	.toggle-btn.ride.on {
		border-color: #0984e3;
		background: rgba(9, 132, 227, 0.12);
	}

	/* AI Placeholder */
	.ai-placeholder {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		background: var(--bg-card);
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg);
		padding: 20px;
		margin-top: 24px;
	}
	.ai-icon { font-size: 1.6rem; }
	.ai-text strong {
		font-size: 0.9rem;
		display: block;
		margin-bottom: 4px;
	}
	.ai-text p {
		font-size: 0.82rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
	}

	/* Mobile */
	@media (max-width: 640px) {
		.race-header { flex-direction: column; }
		.stats-bar { flex-wrap: wrap; gap: 12px; }
		.stat-sep { display: none; }
		.cal-month-col { width: 36px; }
		.cal-header, .cal-week {
			grid-template-columns: 36px repeat(7, 1fr);
		}
		.toggle-btn { font-size: 0.6rem; padding: 1px 2px; }
		.cal-cell { min-height: 52px; padding: 4px 1px; }
	}
</style>
