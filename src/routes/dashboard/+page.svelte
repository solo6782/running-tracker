<script>
	import { formatDistance, formatDuration, formatPace, formatDate, formatDateShort, getSportColor, getSportIcon, getFeelingEmoji } from '$lib/format.js';

	export let data;

	function pctChange(current, previous) {
		if (!previous || previous === 0) return current > 0 ? 100 : 0;
		return Math.round(((current - previous) / previous) * 100);
	}

	function pctChangeLabel(pct) {
		if (pct > 0) return `+${pct}%`;
		if (pct < 0) return `${pct}%`;
		return '=';
	}

	function pctChangeColor(pct) {
		if (pct > 0) return 'var(--success)';
		if (pct < 0) return 'var(--danger)';
		return 'var(--text-muted)';
	}

	// Weekly volume bar chart max
	const maxWeeklyDist = data.weeklyVolume ? Math.max(...data.weeklyVolume.map(w => w.distance), 1) : 1;

	// Sport distribution percentage
	const totalSportCount = data.allTime?.totalActivities || 1;
</script>

<svelte:head>
	<title>Dashboard — Running Tracker</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div class="header-top">
			<h1>🏃 Dashboard</h1>
			<nav class="nav-links">
				<a href="/activities">Activités</a>
			</nav>
		</div>
	</header>

	{#if data.error}
		<div class="error-banner">⚠️ {data.error}</div>
	{:else if data.empty}
		<div class="empty-state">
			<p>Aucune donnée. <a href="/">Importe tes activités Strava</a> d'abord.</p>
		</div>
	{:else}

	<!-- ===== ALL-TIME OVERVIEW ===== -->
	<section class="section">
		<h2 class="section-title">Vue d'ensemble</h2>
		<div class="stats-row">
			<div class="stat-card accent">
				<span class="stat-value">{data.allTime.totalActivities}</span>
				<span class="stat-label">Activités</span>
			</div>
			<div class="stat-card accent">
				<span class="stat-value">{(data.allTime.totalDistance / 1000).toFixed(0)}<small>km</small></span>
				<span class="stat-label">Distance totale</span>
			</div>
			<div class="stat-card accent">
				<span class="stat-value">{Math.floor(data.allTime.totalTime / 3600)}<small>h</small></span>
				<span class="stat-label">Temps total</span>
			</div>
			<div class="stat-card accent">
				<span class="stat-value">{(data.allTime.totalElevation / 1000).toFixed(1)}<small>km</small></span>
				<span class="stat-label">D+ totale</span>
			</div>
		</div>
	</section>

	<!-- ===== THIS WEEK vs LAST WEEK ===== -->
	<section class="section">
		<h2 class="section-title">Cette semaine</h2>
		<div class="comparison-grid">
			<div class="comparison-card">
				<div class="comp-header">
					<span class="comp-value">{data.thisWeek.count}</span>
					<span class="comp-change" style="color: {pctChangeColor(pctChange(data.thisWeek.count, data.lastWeek.count))}">
						{pctChangeLabel(pctChange(data.thisWeek.count, data.lastWeek.count))}
					</span>
				</div>
				<span class="comp-label">Séances</span>
				<span class="comp-prev">Sem. dernière: {data.lastWeek.count}</span>
			</div>
			<div class="comparison-card">
				<div class="comp-header">
					<span class="comp-value">{(data.thisWeek.distance / 1000).toFixed(1)}<small>km</small></span>
					<span class="comp-change" style="color: {pctChangeColor(pctChange(data.thisWeek.distance, data.lastWeek.distance))}">
						{pctChangeLabel(pctChange(data.thisWeek.distance, data.lastWeek.distance))}
					</span>
				</div>
				<span class="comp-label">Distance</span>
				<span class="comp-prev">Sem. dernière: {(data.lastWeek.distance / 1000).toFixed(1)}km</span>
			</div>
			<div class="comparison-card">
				<div class="comp-header">
					<span class="comp-value">{formatDuration(data.thisWeek.time)}</span>
					<span class="comp-change" style="color: {pctChangeColor(pctChange(data.thisWeek.time, data.lastWeek.time))}">
						{pctChangeLabel(pctChange(data.thisWeek.time, data.lastWeek.time))}
					</span>
				</div>
				<span class="comp-label">Durée</span>
				<span class="comp-prev">Sem. dernière: {formatDuration(data.lastWeek.time)}</span>
			</div>
		</div>
	</section>

	<!-- ===== THIS MONTH ===== -->
	<section class="section">
		<h2 class="section-title">Ce mois</h2>
		<div class="comparison-grid">
			<div class="comparison-card">
				<div class="comp-header">
					<span class="comp-value">{data.thisMonth.count}</span>
					<span class="comp-change" style="color: {pctChangeColor(pctChange(data.thisMonth.count, data.lastMonth.count))}">
						{pctChangeLabel(pctChange(data.thisMonth.count, data.lastMonth.count))}
					</span>
				</div>
				<span class="comp-label">Séances</span>
				<span class="comp-prev">Mois dernier: {data.lastMonth.count}</span>
			</div>
			<div class="comparison-card">
				<div class="comp-header">
					<span class="comp-value">{(data.thisMonth.distance / 1000).toFixed(1)}<small>km</small></span>
					<span class="comp-change" style="color: {pctChangeColor(pctChange(data.thisMonth.distance, data.lastMonth.distance))}">
						{pctChangeLabel(pctChange(data.thisMonth.distance, data.lastMonth.distance))}
					</span>
				</div>
				<span class="comp-label">Distance</span>
				<span class="comp-prev">Mois dernier: {(data.lastMonth.distance / 1000).toFixed(1)}km</span>
			</div>
			<div class="comparison-card">
				<div class="comp-header">
					<span class="comp-value">{Math.round(data.thisMonth.elevation)}<small>m</small></span>
					<span class="comp-change" style="color: {pctChangeColor(pctChange(data.thisMonth.elevation, data.lastMonth.elevation))}">
						{pctChangeLabel(pctChange(data.thisMonth.elevation, data.lastMonth.elevation))}
					</span>
				</div>
				<span class="comp-label">D+ Élévation</span>
				<span class="comp-prev">Mois dernier: {Math.round(data.lastMonth.elevation)}m</span>
			</div>
		</div>
	</section>

	<!-- ===== WEEKLY VOLUME (mini bar chart) ===== -->
	<section class="section">
		<h2 class="section-title">Volume hebdo <span class="subtitle-info">(8 dernières semaines)</span></h2>
		<div class="weekly-chart">
			{#each data.weeklyVolume as week, i}
				<div class="week-bar-group">
					<div class="week-bar-container">
						<div
							class="week-bar"
							style="height: {Math.max((week.distance / maxWeeklyDist) * 100, 2)}%"
							class:current={i === data.weeklyVolume.length - 1}
						>
							{#if week.distance > 0}
								<span class="bar-label">{(week.distance / 1000).toFixed(0)}</span>
							{/if}
						</div>
					</div>
					<span class="week-label">
						{#if i === data.weeklyVolume.length - 1}
							Actuel
						{:else}
							S-{data.weeklyVolume.length - 1 - i}
						{/if}
					</span>
					<span class="week-count">{week.count}x</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- ===== PERSONAL BESTS ===== -->
	{#if data.runCount > 0}
	<section class="section">
		<h2 class="section-title">Records personnels 🏃</h2>
		<div class="records-grid">
			{#if data.records.longestRun}
				<div class="record-card">
					<span class="record-icon">📏</span>
					<div class="record-info">
						<span class="record-title">Plus longue course</span>
						<span class="record-value">{formatDistance(data.records.longestRun.value)}</span>
						<span class="record-meta">{data.records.longestRun.name} · {formatDateShort(data.records.longestRun.date)}</span>
					</div>
				</div>
			{/if}
			{#if data.records.fastestPace}
				<div class="record-card">
					<span class="record-icon">⚡</span>
					<div class="record-info">
						<span class="record-title">Allure la plus rapide</span>
						<span class="record-value">{formatPace(data.records.fastestPace.value)}</span>
						<span class="record-meta">{data.records.fastestPace.name} ({formatDistance(data.records.fastestPace.distance)}) · {formatDateShort(data.records.fastestPace.date)}</span>
					</div>
				</div>
			{/if}
			{#if data.records.longestDuration}
				<div class="record-card">
					<span class="record-icon">⏱️</span>
					<div class="record-info">
						<span class="record-title">Plus longue durée</span>
						<span class="record-value">{formatDuration(data.records.longestDuration.value)}</span>
						<span class="record-meta">{data.records.longestDuration.name} · {formatDateShort(data.records.longestDuration.date)}</span>
					</div>
				</div>
			{/if}
			{#if data.records.highestElevation}
				<div class="record-card">
					<span class="record-icon">⛰️</span>
					<div class="record-info">
						<span class="record-title">Plus de D+</span>
						<span class="record-value">{Math.round(data.records.highestElevation.value)}m</span>
						<span class="record-meta">{data.records.highestElevation.name} · {formatDateShort(data.records.highestElevation.date)}</span>
					</div>
				</div>
			{/if}
		</div>
	</section>
	{/if}

	<!-- ===== SPORT DISTRIBUTION ===== -->
	<section class="section">
		<h2 class="section-title">Répartition par sport</h2>
		<div class="sport-list">
			{#each data.sportDistribution as sport}
				<div class="sport-row">
					<div class="sport-info">
						<span class="sport-icon" style="color: {getSportColor(sport.type)}">{getSportIcon(sport.type)}</span>
						<span class="sport-name">{sport.type}</span>
						<span class="sport-count">{sport.count}</span>
					</div>
					<div class="sport-bar-bg">
						<div
							class="sport-bar-fill"
							style="width: {(sport.count / totalSportCount) * 100}%; background: {getSportColor(sport.type)}"
						></div>
					</div>
					<div class="sport-stats">
						<span>{formatDistance(sport.distance)}</span>
						<span class="sep">·</span>
						<span>{formatDuration(sport.time)}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- ===== PERCEPTION STATS ===== -->
	{#if data.perception.rpeCount > 0 || data.perception.feelingCount > 0}
	<section class="section">
		<h2 class="section-title">Ressenti moyen</h2>
		<div class="perception-row">
			{#if data.perception.avgRpe !== null}
				<div class="perception-stat">
					<span class="perc-value">{data.perception.avgRpe.toFixed(1)}<small>/10</small></span>
					<span class="perc-label">RPE moyen</span>
					<span class="perc-meta">{data.perception.rpeCount} activités notées</span>
				</div>
			{/if}
			{#if data.perception.avgFeeling !== null}
				<div class="perception-stat">
					<span class="perc-value">{getFeelingEmoji(Math.round(data.perception.avgFeeling))} {data.perception.avgFeeling.toFixed(1)}<small>/7</small></span>
					<span class="perc-label">Feeling moyen</span>
					<span class="perc-meta">{data.perception.feelingCount} activités notées</span>
				</div>
			{/if}
		</div>
	</section>
	{/if}

	<!-- ===== RECENT ACTIVITIES ===== -->
	<section class="section">
		<h2 class="section-title">Activités récentes</h2>
		<div class="recent-list">
			{#each data.recent as activity}
				<a href="/activities/{activity.id}" class="recent-row">
					<span class="recent-sport" style="color: {getSportColor(activity.sport_type)}">{getSportIcon(activity.sport_type)}</span>
					<div class="recent-info">
						<span class="recent-name">{activity.name || activity.sport_type}</span>
						<span class="recent-meta">{formatDateShort(activity.activity_date)}</span>
					</div>
					<div class="recent-stats">
						<span>{formatDistance(activity.distance_m)}</span>
						<span class="recent-time">{formatDuration(activity.moving_time_s)}</span>
					</div>
				</a>
			{/each}
		</div>
		<a href="/activities" class="see-all">Voir toutes les activités →</a>
	</section>

	{/if}
</div>

<style>
	.page {
		max-width: 900px;
		margin: 0 auto;
		padding: 24px 16px 60px;
	}

	.page-header { margin-bottom: 28px; }
	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
	.nav-links { display: flex; gap: 16px; }
	.nav-links a {
		color: var(--text-secondary);
		font-size: 0.85rem;
		text-decoration: none;
	}
	.nav-links a:hover { color: var(--accent-light); }

	.error-banner {
		background: rgba(255, 107, 107, 0.1);
		border: 1px solid var(--danger);
		border-radius: var(--radius-md);
		padding: 12px 16px;
		color: var(--danger);
	}
	.empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }

	/* Sections */
	.section { margin-bottom: 32px; }
	.section-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}
	.subtitle-info { font-weight: 400; font-size: 0.78rem; color: var(--text-muted); }

	/* All-time stats row */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}
	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 18px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: center;
	}
	.stat-card.accent { border-color: var(--border-light); }
	.stat-value {
		font-family: var(--font-mono);
		font-size: 1.4rem;
		font-weight: 700;
	}
	.stat-value small {
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--text-secondary);
		margin-left: 2px;
	}
	.stat-label {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Comparison grid */
	.comparison-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.comparison-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.comp-header { display: flex; justify-content: space-between; align-items: baseline; }
	.comp-value {
		font-family: var(--font-mono);
		font-size: 1.2rem;
		font-weight: 700;
	}
	.comp-value small { font-size: 0.65rem; font-weight: 400; color: var(--text-secondary); }
	.comp-change {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
	}
	.comp-label {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.comp-prev {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	/* Weekly volume chart */
	.weekly-chart {
		display: flex;
		gap: 8px;
		align-items: flex-end;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 20px 16px 12px;
		height: 200px;
	}
	.week-bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		height: 100%;
	}
	.week-bar-container {
		flex: 1;
		width: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.week-bar {
		width: 80%;
		max-width: 48px;
		background: var(--border-light);
		border-radius: 4px 4px 0 0;
		position: relative;
		min-height: 2px;
		transition: height 0.3s ease;
	}
	.week-bar.current { background: var(--accent); }
	.bar-label {
		position: absolute;
		top: -18px;
		left: 50%;
		transform: translateX(-50%);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}
	.week-label {
		font-size: 0.62rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}
	.week-count {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--text-muted);
	}

	/* Records */
	.records-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}
	.record-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 16px;
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.record-icon { font-size: 1.4rem; }
	.record-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
	.record-title {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.record-value {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		font-weight: 700;
	}
	.record-meta {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Sport distribution */
	.sport-list {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.sport-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
	}
	.sport-row:last-child { border-bottom: none; }
	.sport-info {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 140px;
		flex-shrink: 0;
	}
	.sport-icon { font-size: 1.1rem; }
	.sport-name { font-size: 0.85rem; font-weight: 500; }
	.sport-count {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-left: auto;
	}
	.sport-bar-bg {
		flex: 1;
		height: 6px;
		background: var(--bg-primary);
		border-radius: 3px;
		overflow: hidden;
	}
	.sport-bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
	}
	.sport-stats {
		display: flex;
		gap: 4px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		width: 150px;
		flex-shrink: 0;
		justify-content: flex-end;
	}
	.sep { color: var(--text-muted); }

	/* Perception */
	.perception-row {
		display: flex;
		gap: 12px;
	}
	.perception-stat {
		flex: 1;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 18px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: center;
	}
	.perc-value {
		font-family: var(--font-mono);
		font-size: 1.3rem;
		font-weight: 700;
	}
	.perc-value small { font-size: 0.7rem; font-weight: 400; color: var(--text-secondary); }
	.perc-label {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.perc-meta {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	/* Recent activities */
	.recent-list {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.recent-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
		transition: background 0.1s;
	}
	.recent-row:last-child { border-bottom: none; }
	.recent-row:hover { background: var(--bg-card-hover); text-decoration: none; }
	.recent-sport { font-size: 1.2rem; }
	.recent-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
	.recent-name {
		font-size: 0.88rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.recent-meta { font-size: 0.75rem; color: var(--text-muted); }
	.recent-stats {
		display: flex;
		gap: 12px;
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--text-secondary);
	}
	.recent-time { color: var(--text-muted); }

	.see-all {
		display: block;
		text-align: center;
		margin-top: 12px;
		font-size: 0.85rem;
		color: var(--accent-light);
	}
	.see-all:hover { text-decoration: none; opacity: 0.8; }

	/* Mobile */
	@media (max-width: 640px) {
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.comparison-grid { grid-template-columns: 1fr; }
		.records-grid { grid-template-columns: 1fr; }
		.sport-info { width: 110px; }
		.sport-stats { width: 120px; font-size: 0.7rem; }
		.perception-row { flex-direction: column; }
		.weekly-chart { height: 160px; padding: 16px 10px 10px; }
	}
</style>
