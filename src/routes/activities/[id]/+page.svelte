<script>
	import { formatDistance, formatDuration, formatSpeedForSport, formatPace, formatSpeed, formatHR, formatDate, getSportColor, getSportIcon, getFeelingEmoji } from '$lib/format.js';

	export let data;

	let activity = data.activity;
	let saving = false;
	let savedFeedback = '';

	// Plan prévu
	let plannedWorkout = data.plannedWorkout;
	let planRaceName = data.planRaceName;

	// Laps
	let laps = activity.laps || null;
	let splits = activity.splits_metric || null;
	let bestEfforts = activity.best_efforts || null;
	let lapsLoading = false;
	let lapsError = '';

	// Streams
	let streams = activity.streams || null;
	let streamsLoading = false;
	let streamsError = '';

	// AI Feedback
	let aiFeedback = activity.ai_feedback || '';
	let feedbackLoading = false;
	let feedbackError = '';

	async function fetchLaps() {
		if (laps) return;
		lapsLoading = true;
		lapsError = '';
		try {
			const res = await fetch(`/api/activities/${activity.id}/laps`, { method: 'POST' });
			const data = await res.json();
			if (data.error) { lapsError = data.error; return; }
			laps = data.laps;
			splits = data.splits_metric;
			bestEfforts = data.best_efforts;
		} catch (e) { lapsError = e.message; }
		finally { lapsLoading = false; }
	}

	async function fetchFeedback() {
		feedbackLoading = true;
		feedbackError = '';
		try {
			// Fetch laps first if needed
			if (!laps) await fetchLaps();
			const res = await fetch(`/api/activities/${activity.id}/feedback`, { method: 'POST' });
			const data = await res.json();
			if (data.error) { feedbackError = data.error; return; }
			aiFeedback = data.feedback;
		} catch (e) { feedbackError = e.message; }
		finally { feedbackLoading = false; }
	}

	async function fetchStreams() {
		if (streams) return;
		streamsLoading = true;
		streamsError = '';
		try {
			const res = await fetch(`/api/activities/${activity.id}/streams`, { method: 'POST' });
			const data = await res.json();
			if (data.error) { streamsError = data.error; return; }
			streams = data.streams;
		} catch (e) { streamsError = e.message; }
		finally { streamsLoading = false; }
	}

	// SVG chart helpers
	function buildSvgPath(points, width, height, minY, maxY) {
		if (!points || points.length < 2) return '';
		const rangeY = maxY - minY || 1;
		return points.map((p, i) => {
			const x = (i / (points.length - 1)) * width;
			const y = height - ((p - minY) / rangeY) * height;
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
		}).join(' ');
	}

	function buildAreaPath(points, width, height, minY, maxY) {
		const line = buildSvgPath(points, width, height, minY, maxY);
		if (!line) return '';
		return line + ` L${width},${height} L0,${height} Z`;
	}

	// Convert velocity (m/s) to pace (min/km) — lower pace = faster
	function velocityToPace(v) {
		if (!v || v <= 0) return 12; // cap at 12 min/km
		const pace = (1000 / v) / 60;
		return Math.min(pace, 12);
	}

	// Downsample for smooth rendering
	function smoothData(data, windowSize = 5) {
		if (!data || data.length < windowSize) return data;
		const result = [];
		for (let i = 0; i < data.length; i++) {
			const start = Math.max(0, i - Math.floor(windowSize / 2));
			const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
			let sum = 0;
			for (let j = start; j < end; j++) sum += data[j];
			result.push(sum / (end - start));
		}
		return result;
	}

	function formatLapPace(speed) {
		if (!speed || speed <= 0) return '—';
		const paceTotal = 1000 / speed / 60;
		const min = Math.floor(paceTotal);
		const sec = Math.round((paceTotal - min) * 60);
		return `${min}:${String(sec).padStart(2, '0')}/km`;
	}

	// Auto-fetch laps on mount if not cached
	import { onMount } from 'svelte';
	onMount(() => {
		if (!laps && activity.strava_id) fetchLaps();
	});

	// RPE (1-10)
	let rpe = activity.perceived_difficulty;
	// Feeling (1-7)
	let feeling = activity.perceived_feeling;

	const rpeLabels = ['', 'Repos', 'Très facile', 'Facile', 'Modéré-', 'Modéré', 'Modéré+', 'Difficile', 'Très difficile', 'Extrême', 'Maximum'];
	const feelingLabels = ['', 'Terrible', 'Mauvais', 'Moyen', 'OK', 'Bien', 'Très bien', 'Excellent'];

	function rpeColor(val) {
		if (!val) return 'var(--text-muted)';
		if (val <= 3) return 'var(--success)';
		if (val <= 5) return '#4ecdc4';
		if (val <= 7) return 'var(--warning)';
		if (val <= 8) return '#ff8c42';
		return 'var(--danger)';
	}

	async function savePerception() {
		saving = true;
		try {
			const res = await fetch(`/api/activities/${activity.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					perceived_difficulty: rpe,
					perceived_feeling: feeling
				})
			});
			const result = await res.json();
			if (result.success) {
				savedFeedback = '✓ Sauvegardé';
				setTimeout(() => { savedFeedback = ''; }, 2000);
			}
		} catch (err) {
			savedFeedback = 'Erreur';
		} finally {
			saving = false;
		}
	}

	// Auto-save on change
	function setRpe(val) {
		rpe = val;
		savePerception();
	}
	function setFeeling(val) {
		feeling = val;
		savePerception();
	}

	// Stat helpers
	const isPace = ['Run', 'Walk', 'Swim'].includes(activity.sport_type);
</script>

<svelte:head>
	<title>{activity.name || activity.sport_type} — Running Tracker</title>
</svelte:head>

<div class="page">
	<!-- Navigation -->
	<div class="nav-row">
		<a href="/activities" class="back-link">← Activités</a>
		<div class="nav-arrows">
			{#if data.nextId}
				<a href="/activities/{data.nextId}" class="nav-btn" title="Plus récente">‹</a>
			{/if}
			{#if data.prevId}
				<a href="/activities/{data.prevId}" class="nav-btn" title="Plus ancienne">›</a>
			{/if}
		</div>
	</div>

	<!-- Header -->
	<div class="detail-header">
		<span class="sport-badge" style="background: {getSportColor(activity.sport_type)}20; color: {getSportColor(activity.sport_type)}">
			{getSportIcon(activity.sport_type)} {activity.sport_type}
		</span>
		<h1>{activity.name || '—'}</h1>
		<p class="meta">
			{formatDate(activity.activity_date)}
			{#if activity.gear_name}
				<span class="dot-sep">·</span>
				<span class="gear">👟 {activity.gear_name}</span>
			{/if}
		</p>
		{#if activity.description}
			<p class="description">{activity.description}</p>
		{/if}
	</div>

	<!-- Key stats -->
	<div class="stats-grid">
		<div class="stat-card main">
			<span class="stat-label">Distance</span>
			<span class="stat-value">{formatDistance(activity.distance_m)}</span>
		</div>
		<div class="stat-card main">
			<span class="stat-label">Durée</span>
			<span class="stat-value">{formatDuration(activity.moving_time_s)}</span>
		</div>
		<div class="stat-card main">
			<span class="stat-label">{isPace ? 'Allure moy.' : 'Vitesse moy.'}</span>
			<span class="stat-value">{formatSpeedForSport(activity.avg_speed_ms, activity.sport_type)}</span>
		</div>

		{#if activity.avg_hr}
			<div class="stat-card">
				<span class="stat-label">FC moyenne</span>
				<span class="stat-value">{formatHR(activity.avg_hr)}</span>
			</div>
		{/if}
		{#if activity.max_hr}
			<div class="stat-card">
				<span class="stat-label">FC max</span>
				<span class="stat-value">{formatHR(activity.max_hr)}</span>
			</div>
		{/if}
		{#if activity.elevation_gain}
			<div class="stat-card">
				<span class="stat-label">D+ Élévation</span>
				<span class="stat-value">{Math.round(activity.elevation_gain)}m</span>
			</div>
		{/if}
		{#if activity.calories}
			<div class="stat-card">
				<span class="stat-label">Calories</span>
				<span class="stat-value">{Math.round(activity.calories)} kcal</span>
			</div>
		{/if}
		{#if activity.elapsed_time_s && activity.moving_time_s}
			<div class="stat-card">
				<span class="stat-label">Temps total</span>
				<span class="stat-value">{formatDuration(activity.elapsed_time_s)}</span>
			</div>
		{/if}
		{#if activity.max_speed_ms}
			<div class="stat-card">
				<span class="stat-label">{isPace ? 'Allure max' : 'Vitesse max'}</span>
				<span class="stat-value">{formatSpeedForSport(activity.max_speed_ms, activity.sport_type)}</span>
			</div>
		{/if}
		{#if activity.avg_cadence}
			<div class="stat-card">
				<span class="stat-label">Cadence moy.</span>
				<span class="stat-value">{Math.round(activity.avg_cadence)} spm</span>
			</div>
		{/if}
		{#if activity.avg_watts}
			<div class="stat-card">
				<span class="stat-label">Puissance moy.</span>
				<span class="stat-value">{Math.round(activity.avg_watts)} W</span>
			</div>
		{/if}
		{#if activity.training_load}
			<div class="stat-card">
				<span class="stat-label">Training Load</span>
				<span class="stat-value">{Math.round(activity.training_load)}</span>
			</div>
		{/if}
	</div>

	<!-- RPE & Feeling Section -->
	<div class="perception-section">
		<h2>Ressenti</h2>

		<div class="perception-card">
			<!-- RPE -->
			<div class="perception-group">
				<div class="perception-label">
					<span>Difficulté perçue (RPE)</span>
					{#if rpe}
						<span class="perception-value" style="color: {rpeColor(rpe)}">{rpe}/10 — {rpeLabels[rpe]}</span>
					{:else}
						<span class="perception-hint">Clique pour noter</span>
					{/if}
				</div>
				<div class="rpe-scale">
					{#each [1,2,3,4,5,6,7,8,9,10] as val}
						<button
							class="rpe-btn"
							class:active={rpe === val}
							style="--rpe-color: {rpeColor(val)}"
							on:click={() => setRpe(val)}
						>
							<span class="rpe-num">{val}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Feeling -->
			<div class="perception-group">
				<div class="perception-label">
					<span>Comment tu te sentais ?</span>
					{#if feeling}
						<span class="perception-value">{getFeelingEmoji(feeling)} {feelingLabels[feeling]}</span>
					{:else}
						<span class="perception-hint">Clique pour noter</span>
					{/if}
				</div>
				<div class="feeling-scale">
					{#each [1,2,3,4,5,6,7] as val}
						<button
							class="feeling-btn"
							class:active={feeling === val}
							on:click={() => setFeeling(val)}
						>
							<span class="feeling-emoji">{getFeelingEmoji(val)}</span>
							<span class="feeling-text">{feelingLabels[val]}</span>
						</button>
					{/each}
				</div>
			</div>

			{#if savedFeedback}
				<span class="save-feedback">{savedFeedback}</span>
			{/if}
		</div>
	</div>

	<!-- Plan prévu -->
	{#if plannedWorkout}
		<div class="section plan-section">
			<h2>📋 Séance prévue <span class="plan-race-tag">{planRaceName}</span></h2>
			<div class="plan-preview">
				<div class="plan-preview-header">
					<span class="plan-preview-type" style="color: {plannedWorkout.intensity === 'high' ? 'var(--danger)' : plannedWorkout.intensity === 'moderate' ? 'var(--warning)' : 'var(--success)'}">
						{plannedWorkout.type === 'easy' ? 'Endurance' : plannedWorkout.type === 'tempo' ? 'Seuil' : plannedWorkout.type === 'intervals' ? 'Fractionné' : plannedWorkout.type === 'long' ? 'Sortie longue' : plannedWorkout.type === 'recovery' ? 'Récup' : plannedWorkout.type}
					</span>
					<span class="plan-preview-title">{plannedWorkout.title}</span>
				</div>
				<div class="plan-preview-stats">
					{#if plannedWorkout.duration_min}<span>⏱ {plannedWorkout.duration_min} min prévues</span>{/if}
					{#if plannedWorkout.distance_km}<span>📏 {plannedWorkout.distance_km} km prévus</span>{/if}
				</div>
				{#if plannedWorkout.description}
					<p class="plan-preview-desc">{plannedWorkout.description}</p>
				{/if}
			</div>
		</div>
	{/if}

	<!-- AI Feedback -->
	<div class="section feedback-section">
		<h2>🤖 Analyse IA</h2>
		{#if aiFeedback}
			<div class="ai-feedback-card">
				<p>{aiFeedback}</p>
			</div>
			<button class="btn-refresh-feedback" on:click={fetchFeedback} disabled={feedbackLoading}>
				{feedbackLoading ? '⏳ Analyse...' : '🔄 Ré-analyser'}
			</button>
		{:else}
			<button class="btn-get-feedback" on:click={fetchFeedback} disabled={feedbackLoading}>
				{feedbackLoading ? '⏳ Analyse en cours...' : '🤖 Obtenir l\'analyse IA'}
			</button>
		{/if}
		{#if feedbackError}<p class="error-msg">{feedbackError}</p>{/if}
	</div>

	<!-- Laps -->
	{#if laps && laps.length > 0}
		<div class="section laps-section">
			<h2>🔄 Laps ({laps.length})</h2>
			<div class="laps-table-wrap">
				<table class="laps-table">
					<thead>
						<tr>
							<th>#</th>
							<th>Nom</th>
							<th>Distance</th>
							<th>Durée</th>
							<th>Allure</th>
							<th>FC</th>
						</tr>
					</thead>
					<tbody>
						{#each laps as lap, i}
							<tr>
								<td class="lap-num">{i + 1}</td>
								<td class="lap-name">{lap.name || '—'}</td>
								<td>{(lap.distance / 1000).toFixed(2)} km</td>
								<td>{Math.floor(lap.moving_time / 60)}:{String(Math.round(lap.moving_time % 60)).padStart(2, '0')}</td>
								<td class="lap-pace">{formatLapPace(lap.average_speed)}</td>
								<td>{lap.average_heartrate ? Math.round(lap.average_heartrate) + ' bpm' : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else if lapsLoading}
		<div class="section"><p class="loading-text">⏳ Chargement des laps depuis Strava...</p></div>
	{:else if lapsError}
		<div class="section"><p class="error-msg">{lapsError}</p></div>
	{/if}

	<!-- Splits km -->
	{#if splits && splits.length > 1}
		<div class="section">
			<h2>📊 Splits kilométriques</h2>
			<div class="splits-bars">
				{#each splits as s}
					{@const pace = s.average_speed > 0 ? 1000 / s.average_speed / 60 : 0}
					{@const paceMin = Math.floor(pace)}
					{@const paceSec = Math.round((pace - paceMin) * 60)}
					{@const maxPace = 8}
					{@const minPace = 4}
					{@const barPct = Math.max(5, Math.min(100, ((maxPace - pace) / (maxPace - minPace)) * 100))}
					<div class="split-row">
						<span class="split-label">Km {s.split}</span>
						<div class="split-bar-bg">
							<div class="split-bar" style="width: {barPct}%; background: {pace < 5.5 ? 'var(--danger)' : pace < 6.2 ? 'var(--warning)' : 'var(--success)'}"></div>
						</div>
						<span class="split-pace">{paceMin}:{String(paceSec).padStart(2, '0')}</span>
						{#if s.average_heartrate}<span class="split-hr">{Math.round(s.average_heartrate)}</span>{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Streams Charts -->
	{#if streams}
		{@const chartW = 680}
		{@const chartH = 160}

		<!-- Pace chart -->
		{#if streams.velocity_smooth && streams.distance}
			{@const paceData = smoothData(streams.velocity_smooth.map(v => velocityToPace(v)), 7)}
			{@const minPace = Math.max(3, Math.min(...paceData) - 0.3)}
			{@const maxPace = Math.min(12, Math.max(...paceData) + 0.3)}
			{@const distKm = streams.distance[streams.distance.length - 1] / 1000}
			<div class="section">
				<h2>⚡ Allure</h2>
				<div class="chart-card">
					<div class="chart-labels">
						<span>{Math.floor(minPace)}:{String(Math.round((minPace % 1) * 60)).padStart(2, '0')}/km</span>
						<span>{Math.floor(maxPace)}:{String(Math.round((maxPace % 1) * 60)).padStart(2, '0')}/km</span>
					</div>
					<div class="chart-wrap">
						<svg viewBox="0 0 {chartW} {chartH}" preserveAspectRatio="none" class="stream-chart">
							<!-- Grid lines -->
							{#each [0.25, 0.5, 0.75] as frac}
								<line x1="0" y1={chartH * frac} x2={chartW} y2={chartH * frac} stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,4" />
							{/each}
							<!-- Area fill -->
							<path d={buildAreaPath(paceData, chartW, chartH, maxPace, minPace)} fill="rgba(59, 130, 246, 0.1)" />
							<!-- Line -->
							<path d={buildSvgPath(paceData, chartW, chartH, maxPace, minPace)} fill="none" stroke="#3b82f6" stroke-width="1.5" />
						</svg>
					</div>
					<div class="chart-x-labels">
						<span>0</span>
						<span>{(distKm / 4).toFixed(1)}</span>
						<span>{(distKm / 2).toFixed(1)}</span>
						<span>{(distKm * 3 / 4).toFixed(1)}</span>
						<span>{distKm.toFixed(1)} km</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Heart Rate chart -->
		{#if streams.heartrate}
			{@const hrData = smoothData(streams.heartrate, 7)}
			{@const minHR = Math.max(60, Math.min(...hrData) - 5)}
			{@const maxHR = Math.min(220, Math.max(...hrData) + 5)}
			{@const z2top = chartH - ((140 - minHR) / (maxHR - minHR)) * chartH}
			{@const z3top = chartH - ((155 - minHR) / (maxHR - minHR)) * chartH}
			{@const z4top = chartH - ((170 - minHR) / (maxHR - minHR)) * chartH}
			<div class="section">
				<h2>❤️ Fréquence cardiaque</h2>
				<div class="chart-card">
					<div class="chart-labels">
						<span>{Math.round(maxHR)} bpm</span>
						<span>{Math.round(minHR)} bpm</span>
					</div>
					<div class="chart-wrap">
						<svg viewBox="0 0 {chartW} {chartH}" preserveAspectRatio="none" class="stream-chart">
							{#each [0.25, 0.5, 0.75] as frac}
								<line x1="0" y1={chartH * frac} x2={chartW} y2={chartH * frac} stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,4" />
							{/each}
							<!-- Zone color bands -->
							<rect x="0" y={Math.max(0, z4top)} width={chartW} height={Math.max(0, chartH - z4top)} fill="rgba(239, 68, 68, 0.04)" />
							<rect x="0" y={Math.max(0, z3top)} width={chartW} height={Math.max(0, z4top - z3top)} fill="rgba(234, 179, 8, 0.04)" />
							<rect x="0" y={Math.max(0, z2top)} width={chartW} height={Math.max(0, z3top - z2top)} fill="rgba(34, 197, 94, 0.04)" />
							<!-- Area + Line -->
							<path d={buildAreaPath(hrData, chartW, chartH, minHR, maxHR)} fill="rgba(239, 68, 68, 0.1)" />
							<path d={buildSvgPath(hrData, chartW, chartH, minHR, maxHR)} fill="none" stroke="#ef4444" stroke-width="1.5" />
						</svg>
					</div>
					<div class="chart-zone-legend">
						<span class="zone z1">Z1-2</span>
						<span class="zone z3">Z3</span>
						<span class="zone z4">Z4-5</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Altitude profile -->
		{#if streams.altitude}
			{@const altData = smoothData(streams.altitude, 5)}
			{@const minAlt = Math.min(...altData) - 5}
			{@const maxAlt = Math.max(...altData) + 5}
			<div class="section">
				<h2>⛰️ Altitude</h2>
				<div class="chart-card">
					<div class="chart-labels">
						<span>{Math.round(maxAlt)}m</span>
						<span>{Math.round(minAlt)}m</span>
					</div>
					<div class="chart-wrap">
						<svg viewBox="0 0 {chartW} {chartH * 0.75}" preserveAspectRatio="none" class="stream-chart altitude">
							<defs>
								<linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color="rgba(16, 185, 129, 0.3)" />
									<stop offset="100%" stop-color="rgba(16, 185, 129, 0.02)" />
								</linearGradient>
							</defs>
							<path d={buildAreaPath(altData, chartW, chartH * 0.75, minAlt, maxAlt)} fill="url(#altGrad)" />
							<path d={buildSvgPath(altData, chartW, chartH * 0.75, minAlt, maxAlt)} fill="none" stroke="#10b981" stroke-width="1.5" />
						</svg>
					</div>
				</div>
			</div>
		{/if}

		<!-- Cadence chart -->
		{#if streams.cadence}
			{@const cadData = smoothData(streams.cadence, 7)}
			{@const minCad = Math.max(0, Math.min(...cadData.filter(c => c > 0)) - 5)}
			{@const maxCad = Math.max(...cadData) + 5}
			<div class="section">
				<h2>🦶 Cadence</h2>
				<div class="chart-card">
					<div class="chart-labels">
						<span>{Math.round(maxCad)} spm</span>
						<span>{Math.round(minCad)} spm</span>
					</div>
					<div class="chart-wrap">
						<svg viewBox="0 0 {chartW} {chartH * 0.6}" preserveAspectRatio="none" class="stream-chart">
							<path d={buildAreaPath(cadData, chartW, chartH * 0.6, minCad, maxCad)} fill="rgba(168, 85, 247, 0.08)" />
							<path d={buildSvgPath(cadData, chartW, chartH * 0.6, minCad, maxCad)} fill="none" stroke="#a855f7" stroke-width="1.5" />
						</svg>
					</div>
				</div>
			</div>
		{/if}

	{:else if !streams && activity.strava_id}
		<div class="section">
			<h2>📈 Graphiques détaillés</h2>
			{#if streamsLoading}
				<p class="loading-text">⏳ Chargement des streams depuis Strava...</p>
			{:else if streamsError}
				<p class="error-msg">{streamsError}</p>
			{:else}
				<button class="btn-get-streams" on:click={fetchStreams}>
					📈 Charger les graphiques (allure, FC, altitude)
				</button>
			{/if}
		</div>
	{/if}

	<!-- Best efforts -->
	{#if bestEfforts && bestEfforts.length > 0}
		<div class="section">
			<h2>🏅 Meilleurs efforts</h2>
			<div class="best-efforts">
				{#each bestEfforts as e}
					<div class="effort-chip">
						<span class="effort-name">{e.name}</span>
						<span class="effort-time">{Math.floor(e.moving_time / 60)}:{String(Math.round(e.moving_time % 60)).padStart(2, '0')}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Elevation details -->
	{#if activity.elevation_low || activity.elevation_high}
		<div class="section">
			<h2>Élévation</h2>
			<div class="elevation-row">
				{#if activity.elevation_gain}<span>↑ {Math.round(activity.elevation_gain)}m</span>{/if}
				{#if activity.elevation_loss}<span>↓ {Math.round(activity.elevation_loss)}m</span>{/if}
				{#if activity.elevation_low}<span>Min: {Math.round(activity.elevation_low)}m</span>{/if}
				{#if activity.elevation_high}<span>Max: {Math.round(activity.elevation_high)}m</span>{/if}
			</div>
		</div>
	{/if}

	<!-- Strava link -->
	<div class="strava-link">
		<a href="https://www.strava.com/activities/{activity.strava_id}" target="_blank" rel="noopener">
			Voir sur Strava ↗
		</a>
	</div>
</div>

<style>
	.page {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px 16px 60px;
	}

	/* Navigation */
	.nav-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}
	.back-link {
		color: var(--text-secondary);
		font-size: 0.85rem;
	}
	.back-link:hover { color: var(--accent-light); text-decoration: none; }
	.nav-arrows { display: flex; gap: 6px; }
	.nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 1.1rem;
		text-decoration: none;
	}
	.nav-btn:hover { border-color: var(--accent); color: var(--accent-light); text-decoration: none; }

	/* Header */
	.detail-header {
		margin-bottom: 28px;
	}
	.sport-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.78rem;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: 20px;
		margin-bottom: 10px;
	}
	h1 {
		font-size: 1.6rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-bottom: 6px;
	}
	.meta {
		color: var(--text-secondary);
		font-size: 0.88rem;
	}
	.dot-sep { margin: 0 6px; opacity: 0.4; }
	.gear { font-size: 0.82rem; }
	.description {
		margin-top: 10px;
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1.5;
		font-style: italic;
	}

	/* Stats grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-bottom: 32px;
	}

	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.stat-card.main {
		border-color: var(--border-light);
	}
	.stat-label {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.stat-value {
		font-family: var(--font-mono);
		font-size: 1.05rem;
		font-weight: 600;
	}

	/* Perception section */
	.perception-section {
		margin-bottom: 28px;
	}
	.perception-section h2, .section h2 {
		font-size: 1rem;
		font-weight: 600;
		margin-bottom: 12px;
		color: var(--text-secondary);
	}

	.perception-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 24px;
		position: relative;
	}

	.perception-group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.perception-label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 0.88rem;
		font-weight: 500;
	}
	.perception-value {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		font-weight: 600;
	}
	.perception-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
		font-style: italic;
	}

	/* RPE scale */
	.rpe-scale {
		display: flex;
		gap: 4px;
	}
	.rpe-btn {
		flex: 1;
		height: 38px;
		border-radius: var(--radius-sm);
		border: 1.5px solid var(--border);
		background: transparent;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.82rem;
		transition: all 0.15s;
		padding: 0;
	}
	.rpe-btn:hover {
		border-color: var(--rpe-color);
		color: var(--rpe-color);
		background: color-mix(in srgb, var(--rpe-color) 10%, transparent);
	}
	.rpe-btn.active {
		background: var(--rpe-color);
		border-color: var(--rpe-color);
		color: white;
	}

	/* Feeling scale */
	.feeling-scale {
		display: flex;
		gap: 4px;
	}
	.feeling-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 8px 4px;
		border-radius: var(--radius-sm);
		border: 1.5px solid var(--border);
		background: transparent;
		cursor: pointer;
		transition: all 0.15s;
		opacity: 0.5;
		filter: grayscale(80%);
	}
	.feeling-btn:hover {
		opacity: 0.85;
		border-color: var(--border-light);
		filter: grayscale(0%);
	}
	.feeling-btn.active {
		opacity: 1;
		border-color: var(--accent);
		background: var(--accent-glow);
		filter: grayscale(0%);
	}
	.feeling-emoji { font-size: 1.3rem; }
	.feeling-text {
		font-size: 0.6rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.save-feedback {
		position: absolute;
		top: 12px;
		right: 16px;
		font-size: 0.78rem;
		color: var(--success);
		font-family: var(--font-mono);
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* Elevation */
	.section { margin-bottom: 28px; }
	.elevation-row {
		display: flex;
		gap: 20px;
		flex-wrap: wrap;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 14px 16px;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	/* Strava link */
	.strava-link {
		text-align: center;
		margin-top: 16px;
	}
	.strava-link a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: #fc4c02;
		font-weight: 600;
		font-size: 0.88rem;
		padding: 10px 20px;
		border: 1px solid rgba(252, 76, 2, 0.3);
		border-radius: var(--radius-md);
		transition: all 0.15s;
	}
	.strava-link a:hover {
		background: rgba(252, 76, 2, 0.1);
		text-decoration: none;
	}

	/* Mobile */
	@media (max-width: 520px) {
		.stats-grid { grid-template-columns: repeat(2, 1fr); }
		.rpe-btn { height: 34px; font-size: 0.75rem; }
		.feeling-emoji { font-size: 1.1rem; }
		.feeling-text { display: none; }
		.laps-table { font-size: 0.72rem; }
	}

	/* Plan prévu */
	.plan-section h2 { display: flex; align-items: center; gap: 8px; }
	.plan-race-tag { font-size: 0.7rem; font-weight: 600; background: var(--accent-glow); color: var(--accent); padding: 2px 8px; border-radius: 10px; }
	.plan-preview { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; border-left: 3px solid var(--accent); }
	.plan-preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
	.plan-preview-type { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; }
	.plan-preview-title { font-weight: 600; font-size: 0.88rem; }
	.plan-preview-stats { display: flex; gap: 12px; font-size: 0.78rem; color: var(--text-secondary); font-family: var(--font-mono); }
	.plan-preview-desc { font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; margin-top: 6px; }

	/* AI Feedback */
	.feedback-section { }
	.ai-feedback-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; border-left: 3px solid #8b5cf6; }
	.ai-feedback-card p { font-size: 0.82rem; line-height: 1.6; color: var(--text-primary); margin: 0; white-space: pre-line; }
	.btn-get-feedback, .btn-refresh-feedback { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); cursor: pointer; font-size: 0.82rem; color: var(--text-secondary); transition: all 0.15s; }
	.btn-get-feedback:hover, .btn-refresh-feedback:hover { border-color: #8b5cf6; color: #8b5cf6; }
	.btn-get-feedback:disabled, .btn-refresh-feedback:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-refresh-feedback { margin-top: 8px; font-size: 0.75rem; padding: 5px 12px; }
	.error-msg { color: var(--danger); font-size: 0.8rem; margin-top: 6px; }
	.loading-text { color: var(--text-muted); font-size: 0.82rem; }

	/* Laps table */
	.laps-section { }
	.laps-table-wrap { overflow-x: auto; }
	.laps-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
	.laps-table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid var(--border); color: var(--text-muted); font-weight: 600; font-size: 0.72rem; text-transform: uppercase; }
	.laps-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); font-family: var(--font-mono); }
	.lap-num { color: var(--text-muted); font-size: 0.72rem; }
	.lap-name { color: var(--text-secondary); font-family: var(--font-sans); }
	.lap-pace { font-weight: 600; }

	/* Splits bars */
	.splits-bars { display: flex; flex-direction: column; gap: 3px; }
	.split-row { display: flex; align-items: center; gap: 8px; }
	.split-label { width: 40px; font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono); flex-shrink: 0; }
	.split-bar-bg { flex: 1; height: 18px; background: var(--surface); border-radius: 3px; overflow: hidden; }
	.split-bar { height: 100%; border-radius: 3px; transition: width 0.3s; }
	.split-pace { width: 44px; font-size: 0.72rem; font-family: var(--font-mono); font-weight: 600; text-align: right; flex-shrink: 0; }
	.split-hr { width: 28px; font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-muted); text-align: right; flex-shrink: 0; }

	/* Best efforts */
	.best-efforts { display: flex; flex-wrap: wrap; gap: 6px; }
	.effort-chip { display: flex; align-items: center; gap: 6px; padding: 5px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; font-size: 0.78rem; }
	.effort-name { color: var(--text-secondary); }
	.effort-time { font-weight: 600; font-family: var(--font-mono); }

	/* Stream charts */
	.chart-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 14px 16px;
	}
	.chart-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.68rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		margin-bottom: 4px;
	}
	.chart-wrap {
		width: 100%;
		overflow: hidden;
	}
	.stream-chart {
		width: 100%;
		height: auto;
		display: block;
	}
	.stream-chart.altitude {
		height: auto;
	}
	.chart-x-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.65rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
		margin-top: 4px;
	}
	.chart-zone-legend {
		display: flex;
		gap: 12px;
		justify-content: center;
		margin-top: 6px;
		font-size: 0.65rem;
		font-family: var(--font-mono);
	}
	.zone {
		padding: 1px 6px;
		border-radius: 3px;
	}
	.zone.z1 { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
	.zone.z3 { background: rgba(234, 179, 8, 0.12); color: #eab308; }
	.zone.z4 { background: rgba(239, 68, 68, 0.12); color: #ef4444; }

	.btn-get-streams {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		cursor: pointer;
		font-size: 0.82rem;
		color: var(--text-secondary);
		transition: all 0.15s;
	}
	.btn-get-streams:hover { border-color: #3b82f6; color: #3b82f6; }
</style>
