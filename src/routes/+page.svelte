<script>
	export let data;

	let importing = false;
	let importStatus = '';
	let importCount = 0;

	async function startImport() {
		importing = true;
		importStatus = 'Import en cours...';

		try {
			const res = await fetch('/api/strava/import', { method: 'POST' });
			const result = await res.json();

			if (result.success) {
				importCount = result.count;
				importStatus = `Import terminé ! ${result.count} activités importées.`;
			} else {
				importStatus = `Erreur : ${result.error}`;
			}
		} catch (err) {
			importStatus = `Erreur : ${err.message}`;
		} finally {
			importing = false;
		}
	}
</script>

<div class="container">
	<div class="hero">
		<div class="logo">🏃</div>
		<h1>Running Tracker</h1>
		<p class="subtitle">Suivi multi-sport intelligent</p>
	</div>

	{#if data.error}
		<div class="card error-card">
			<p class="error-text">⚠️ {data.error}</p>
		</div>
	{/if}

	{#if !data.isConnected}
		<div class="card">
			<h2>Connexion Strava</h2>
			<p>Connecte ton compte Strava pour synchroniser automatiquement toutes tes activités.</p>
			<a href={data.stravaAuthUrl} class="btn btn-strava">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
				</svg>
				Connecter Strava
			</a>
		</div>
	{:else}
		<div class="card">
			<div class="status-connected">
				<span class="dot"></span>
				Strava connecté (Athlete #{data.athleteId})
			</div>

			{#if data.activityCount > 0}
				<a href="/dashboard" class="btn btn-primary">
					📊 Dashboard
				</a>
				<a href="/activities" class="btn btn-secondary">
					🏃 Voir mes activités ({data.activityCount})
				</a>
			{/if}

			{#if !importCount && !data.activityCount}
				<button class="btn btn-primary" on:click={startImport} disabled={importing}>
					{#if importing}
						<span class="spinner"></span>
						Import en cours...
					{:else}
						📥 Importer l'historique Strava
					{/if}
				</button>
			{/if}

			{#if importStatus}
				<p class="import-status">{importStatus}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 480px;
		margin: 0 auto;
		padding: 60px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 32px;
	}

	.hero {
		text-align: center;
	}

	.logo {
		font-size: 64px;
		margin-bottom: 12px;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.subtitle {
		color: var(--text-secondary);
		margin-top: 4px;
		font-size: 1.05rem;
	}

	.card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 32px;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.error-card {
		border-color: var(--danger);
		background: rgba(255, 107, 107, 0.1);
	}

	.error-text {
		color: var(--danger);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		word-break: break-all;
	}

	.card h2 {
		font-size: 1.2rem;
		font-weight: 600;
	}

	.card p {
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 14px 24px;
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 0.95rem;
		border: none;
		transition: all 0.2s;
		text-decoration: none;
	}

	.btn-strava {
		background: #fc4c02;
		color: white;
	}

	.btn-strava:hover {
		background: #e04400;
		text-decoration: none;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-primary:hover {
		background: var(--accent-light);
	}

	.btn-secondary {
		background: var(--bg-input);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		border-color: var(--accent);
		color: var(--accent-light);
		text-decoration: none;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.status-connected {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--success);
		font-weight: 500;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--success);
	}

	.import-status {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--text-secondary);
		padding: 12px;
		background: var(--bg-primary);
		border-radius: var(--radius-sm);
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid transparent;
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
