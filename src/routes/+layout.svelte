<script>
	import '../app.css';
	import { page } from '$app/stores';

	$: path = $page.url.pathname;
</script>

<div class="app">
	<nav class="navbar">
		<a href="/dashboard" class="nav-brand">🏃 Running Tracker</a>
		<div class="nav-links">
			<a href="/dashboard" class="nav-link" class:active={path === '/dashboard'}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
				<span>Dashboard</span>
			</a>
			<a href="/activities" class="nav-link" class:active={path.startsWith('/activities')}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
				<span>Activités</span>
			</a>
			<a href="/charts" class="nav-link" class:active={path === '/charts'}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
				<span>Graphiques</span>
			</a>
		</div>
	</nav>
	<main class="main-content">
		<slot />
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.navbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		height: 52px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
		flex-shrink: 0;
	}

	.nav-brand {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		text-decoration: none;
		letter-spacing: -0.02em;
	}
	.nav-brand:hover { text-decoration: none; opacity: 0.85; }

	.nav-links {
		display: flex;
		gap: 4px;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: var(--radius-md);
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		transition: all 0.15s;
	}
	.nav-link:hover {
		background: rgba(108, 92, 231, 0.08);
		color: var(--text-primary);
		text-decoration: none;
	}
	.nav-link.active {
		background: rgba(108, 92, 231, 0.15);
		color: var(--accent-light);
	}
	.nav-link svg { flex-shrink: 0; }

	.main-content { flex: 1; }

	@media (max-width: 600px) {
		.navbar { padding: 0 12px; height: 48px; }
		.nav-brand { font-size: 0.85rem; }
		.nav-link span { display: none; }
		.nav-link { padding: 8px 10px; }
	}
</style>
