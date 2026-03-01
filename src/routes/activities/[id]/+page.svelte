<script>
	import { formatDistance, formatDuration, formatSpeedForSport, formatPace, formatSpeed, formatHR, formatDate, getSportColor, getSportIcon, getFeelingEmoji } from '$lib/format.js';

	export let data;

	let activity = data.activity;
	let saving = false;
	let savedFeedback = '';

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
	}
</style>
