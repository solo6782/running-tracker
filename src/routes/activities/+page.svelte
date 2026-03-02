<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatDistance, formatDuration, formatSpeedForSport, formatHR, formatDate, getSportColor, getSportIcon, getFeelingEmoji } from '$lib/format.js';

	export let data;

	let filtersOpen = false;
	let searchInput = data.filters.search || '';
	let searchTimeout;

	function updateUrl(params) {
		const url = new URL($page.url);
		for (const [key, val] of Object.entries(params)) {
			if (val && val !== 'all' && val !== '') {
				url.searchParams.set(key, val);
			} else {
				url.searchParams.delete(key);
			}
		}
		// Reset to page 1 when changing filters
		if (!params.page) url.searchParams.delete('page');
		goto(url.toString(), { keepFocus: true });
	}

	function onSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			updateUrl({ q: searchInput });
		}, 300);
	}

	function onSportFilter(e) {
		updateUrl({ sport: e.target.value });
	}

	function onSort(field) {
		const currentSort = data.filters.sortBy;
		const currentDir = data.filters.sortDir;
		const newDir = (currentSort === field && currentDir === 'desc') ? 'asc' : 'desc';
		updateUrl({ sort: field, dir: newDir });
	}

	function goToPage(p) {
		updateUrl({ page: p, sport: data.filters.sportType, from: data.filters.dateFrom, to: data.filters.dateTo, q: data.filters.search, sort: data.filters.sortBy, dir: data.filters.sortDir });
	}

	function sortIndicator(field) {
		if (data.filters.sortBy !== field) return '';
		return data.filters.sortDir === 'asc' ? ' ↑' : ' ↓';
	}

	// RPE color scale
	function rpeColor(val) {
		if (!val) return 'var(--text-muted)';
		if (val <= 3) return 'var(--success)';
		if (val <= 5) return '#4ecdc4';
		if (val <= 7) return 'var(--warning)';
		if (val <= 8) return '#ff8c42';
		return 'var(--danger)';
	}
</script>

<svelte:head>
	<title>Activités — Running Tracker</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div class="header-top">
			<h1>Activités</h1>
			<span class="count">{data.total} activités</span>
		</div>

		<!-- Search + Filters -->
		<div class="controls">
			<div class="search-bar">
				<svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
				</svg>
				<input
					type="text"
					placeholder="Rechercher une activité..."
					bind:value={searchInput}
					on:input={onSearch}
				/>
			</div>

			<div class="filter-row">
				<select value={data.filters.sportType} on:change={onSportFilter} class="select">
					<option value="all">Tous les sports ({data.total})</option>
					{#each data.sportTypes as st}
						<option value={st.type}>{getSportIcon(st.type)} {st.type} ({st.count})</option>
					{/each}
				</select>

				<button class="btn-icon" on:click={() => filtersOpen = !filtersOpen} class:active={filtersOpen}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
					</svg>
				</button>
			</div>

			{#if filtersOpen}
				<div class="filters-panel">
					<div class="filter-group">
						<label>Du</label>
						<input type="date" value={data.filters.dateFrom} on:change={(e) => updateUrl({ from: e.target.value })} />
					</div>
					<div class="filter-group">
						<label>Au</label>
						<input type="date" value={data.filters.dateTo} on:change={(e) => updateUrl({ to: e.target.value })} />
					</div>
				</div>
			{/if}
		</div>
	</header>

	{#if data.error}
		<div class="error-banner">⚠️ {data.error}</div>
	{/if}

	<!-- Activities List -->
	<div class="activities-list">
		<!-- Table header (sortable) -->
		<div class="list-header">
			<button class="col col-date" on:click={() => onSort('activity_date')}>
				Date{sortIndicator('activity_date')}
			</button>
			<div class="col col-name">Activité</div>
			<button class="col col-dist" on:click={() => onSort('distance_m')}>
				Dist.{sortIndicator('distance_m')}
			</button>
			<button class="col col-time" on:click={() => onSort('moving_time_s')}>
				Durée{sortIndicator('moving_time_s')}
			</button>
			<button class="col col-pace" on:click={() => onSort('avg_speed_ms')}>
				Allure{sortIndicator('avg_speed_ms')}
			</button>
			<button class="col col-hr" on:click={() => onSort('avg_hr')}>
				FC{sortIndicator('avg_hr')}
			</button>
			<button class="col col-elev" on:click={() => onSort('elevation_gain')}>
				D+{sortIndicator('elevation_gain')}
			</button>
			<div class="col col-rpe">RPE</div>
			<div class="col col-feel">Ressenti</div>
		</div>

		{#each data.activities as activity (activity.id)}
			<a href="/activities/{activity.id}" class="activity-row">
				<div class="col col-date">
					<span class="date-text">{formatDate(activity.activity_date)}</span>
				</div>
				<div class="col col-name">
					<span class="sport-badge" style="background: {getSportColor(activity.sport_type)}20; color: {getSportColor(activity.sport_type)}">
						{getSportIcon(activity.sport_type)} {activity.sport_type}
					</span>
					<span class="activity-name">{activity.name || '—'}</span>
					{#if activity.activity_date && data.plannedDates[activity.activity_date.split('T')[0]]}
						<span class="plan-badge" title="Séance prévue : {data.plannedDates[activity.activity_date.split('T')[0]].title} ({data.plannedDates[activity.activity_date.split('T')[0]].race})">📋</span>
					{/if}
				</div>
				<div class="col col-dist mono">{formatDistance(activity.distance_m)}</div>
				<div class="col col-time mono">{formatDuration(activity.moving_time_s)}</div>
				<div class="col col-pace mono">{formatSpeedForSport(activity.avg_speed_ms, activity.sport_type)}</div>
				<div class="col col-hr mono">{formatHR(activity.avg_hr)}</div>
				<div class="col col-elev mono">{activity.elevation_gain ? Math.round(activity.elevation_gain) + 'm' : '—'}</div>
				<div class="col col-rpe">
					{#if activity.perceived_difficulty}
						<span class="rpe-badge" style="background: {rpeColor(activity.perceived_difficulty)}20; color: {rpeColor(activity.perceived_difficulty)}">{activity.perceived_difficulty}</span>
					{:else}
						<span class="val-empty">—</span>
					{/if}
				</div>
				<div class="col col-feel">
					{#if activity.perceived_feeling}
						<span class="feel-badge">{getFeelingEmoji(activity.perceived_feeling)}</span>
					{:else}
						<span class="val-empty">—</span>
					{/if}
				</div>
			</a>
		{:else}
			<div class="empty-state">
				<p>Aucune activité trouvée</p>
			</div>
		{/each}
	</div>

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="pagination">
			<button class="page-btn" disabled={data.page <= 1} on:click={() => goToPage(data.page - 1)}>
				← Précédent
			</button>
			<span class="page-info">
				Page {data.page} / {data.totalPages}
			</span>
			<button class="page-btn" disabled={data.page >= data.totalPages} on:click={() => goToPage(data.page + 1)}>
				Suivant →
			</button>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px 16px;
	}

	.page-header {
		margin-bottom: 24px;
	}

	.header-top {
		display: flex;
		align-items: baseline;
		gap: 16px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.count {
		color: var(--text-secondary);
		font-size: 0.85rem;
		font-family: var(--font-mono);
	}

	/* Controls */
	.controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0 14px;
	}
	.search-icon { color: var(--text-muted); flex-shrink: 0; }
	.search-bar input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.9rem;
		padding: 10px 0;
		outline: none;
	}
	.search-bar input::placeholder { color: var(--text-muted); }

	.filter-row {
		display: flex;
		gap: 8px;
	}

	.select {
		flex: 1;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.85rem;
		padding: 8px 12px;
		outline: none;
		cursor: pointer;
	}
	.select option { background: var(--bg-card); }

	.btn-icon {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		padding: 8px 12px;
		transition: all 0.15s;
	}
	.btn-icon:hover, .btn-icon.active {
		border-color: var(--accent);
		color: var(--accent-light);
	}

	.filters-panel {
		display: flex;
		gap: 12px;
		padding: 12px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}
	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}
	.filter-group label {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.filter-group input {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.85rem;
		padding: 6px 8px;
		outline: none;
	}

	.error-banner {
		background: rgba(255, 107, 107, 0.1);
		border: 1px solid var(--danger);
		border-radius: var(--radius-md);
		padding: 12px 16px;
		color: var(--danger);
		font-size: 0.85rem;
		margin-bottom: 16px;
	}

	/* List */
	.activities-list {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--bg-card);
	}

	.list-header {
		display: flex;
		padding: 10px 16px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border);
		gap: 4px;
	}
	.list-header .col {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		font-weight: 600;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		font-family: var(--font-sans);
		text-align: left;
	}
	.list-header .col:hover { color: var(--text-secondary); }

	.activity-row {
		display: flex;
		align-items: center;
		border-bottom: 1px solid var(--border);
		transition: background 0.1s;
		padding: 12px 16px;
		text-decoration: none;
		color: inherit;
		gap: 4px;
	}
	.activity-row:last-child { border-bottom: none; }
	.activity-row:hover { background: var(--bg-card-hover); text-decoration: none; }

	.col { flex-shrink: 0; }
	.col-date { width: 110px; }
	.col-name { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
	.col-dist { width: 72px; text-align: right; }
	.col-time { width: 60px; text-align: right; }
	.col-pace { width: 72px; text-align: right; }
	.col-hr { width: 58px; text-align: right; }
	.col-elev { width: 50px; text-align: right; }
	.col-rpe { width: 40px; text-align: center; }
	.col-feel { width: 40px; text-align: center; }

	.date-text {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.sport-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 20px;
		width: fit-content;
		white-space: nowrap;
	}

	.activity-name {
		font-size: 0.88rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.plan-badge { font-size: 0.72rem; flex-shrink: 0; cursor: help; }

	.mono {
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	/* RPE badge */
	.rpe-badge {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
	}

	/* Feeling badge */
	.feel-badge {
		font-size: 1rem;
	}

	.val-empty {
		color: var(--text-muted);
		font-size: 0.8rem;
	}
	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		margin-top: 24px;
		padding: 16px;
	}

	.page-btn {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.85rem;
		padding: 8px 16px;
		transition: all 0.15s;
	}
	.page-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent-light);
	}
	.page-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.page-info {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.empty-state {
		padding: 60px 20px;
		text-align: center;
		color: var(--text-muted);
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.list-header { display: none; }

		.activity-row {
			flex-direction: column;
			align-items: stretch;
			padding: 0;
		}

		.row-link {
			flex-wrap: wrap;
			gap: 6px;
			padding: 12px 14px;
		}

		.col-date { width: auto; }
		.col-name { width: 100%; order: -1; }
		.col-dist, .col-time, .col-pace, .col-hr {
			width: auto;
			text-align: left;
			font-size: 0.78rem;
		}
		.col-rpe, .col-feel {
			width: auto;
			padding: 0 14px 10px;
		}

		.rpe-selector, .feeling-selector {
			gap: 3px;
		}
		.rpe-dot { width: 24px; height: 24px; font-size: 0.65rem; }
		.feeling-btn { font-size: 1rem; padding: 3px; }
	}
</style>
