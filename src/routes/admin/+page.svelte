<script>
	let status = null;
	let loading = true;
	let actionResult = null;
	let actionLoading = false;

	import { onMount } from 'svelte';
	onMount(async () => {
		await checkStatus();
	});

	async function checkStatus() {
		loading = true;
		try {
			const res = await fetch('/api/strava/admin');
			status = await res.json();
		} catch (e) { status = { error: e.message }; }
		loading = false;
	}

	async function doAction(action) {
		actionLoading = true;
		actionResult = null;
		try {
			const res = await fetch('/api/strava/admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action })
			});
			actionResult = await res.json();
			// Refresh status after action
			await checkStatus();
		} catch (e) { actionResult = { error: e.message }; }
		actionLoading = false;
	}
</script>

<svelte:head>
	<title>Admin Strava — Running Tracker</title>
</svelte:head>

<div class="page">
	<a href="/" class="back-link">← Accueil</a>
	<h1>🔧 Admin Strava</h1>

	{#if loading}
		<p class="loading">⏳ Vérification...</p>
	{:else if status}

		<!-- Webhook Status -->
		<div class="card">
			<h2>📡 Webhook</h2>
			{#if status.subscriptionStatus === 'active'}
				<div class="status-ok">✅ Webhook actif</div>
				<pre class="json">{JSON.stringify(status.subscriptions, null, 2)}</pre>
			{:else if status.subscriptionStatus === 'none'}
				<div class="status-warn">⚠️ Aucun webhook enregistré</div>
				<p class="hint">Les nouvelles activités Strava ne sont pas poussées automatiquement.</p>
				<button class="btn btn-primary" on:click={() => doAction('subscribe')} disabled={actionLoading}>
					{actionLoading ? '⏳...' : '🔗 Créer le webhook'}
				</button>
				{#if !status.hasVerifyToken}
					<p class="hint warn">⚠️ STRAVA_WEBHOOK_VERIFY_TOKEN non configuré dans Cloudflare. Ajoute-le avant de créer le webhook.</p>
				{/if}
			{:else}
				<div class="status-warn">❓ Statut inconnu</div>
				{#if status.subscriptionError}
					<p class="error">{status.subscriptionError}</p>
				{/if}
			{/if}
			<p class="hint">Callback URL : <code>{status.callbackUrl}</code></p>
		</div>

		<!-- Missing Activities -->
		<div class="card">
			<h2>🏃 Activités récentes</h2>
			{#if status.recentStrava}
				<table class="table">
					<thead>
						<tr><th>Date</th><th>Nom</th><th>Type</th><th>Statut</th></tr>
					</thead>
					<tbody>
						{#each status.recentStrava as act}
							<tr>
								<td class="mono">{act.date?.split('T')[0]}</td>
								<td>{act.name}</td>
								<td>{act.type}</td>
								<td>{act.imported ? '✅ Importée' : '❌ Manquante'}</td>
							</tr>
						{/each}
					</tbody>
				</table>

				{#if status.missingCount > 0}
					<button class="btn btn-primary" on:click={() => doAction('sync')} disabled={actionLoading}>
						{actionLoading ? '⏳ Import...' : `📥 Importer ${status.missingCount} activité(s) manquante(s)`}
					</button>
				{:else}
					<p class="status-ok">✅ Toutes les activités récentes sont importées</p>
				{/if}
			{:else if status.stravaError}
				<p class="error">{status.stravaError}</p>
			{/if}
		</div>

		<!-- Action Result -->
		{#if actionResult}
			<div class="card">
				<h2>📋 Résultat</h2>
				<pre class="json">{JSON.stringify(actionResult, null, 2)}</pre>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page { max-width: 720px; margin: 0 auto; padding: 24px 16px 60px; }
	.back-link { color: var(--text-secondary); font-size: 0.85rem; }
	.back-link:hover { color: var(--accent-light); text-decoration: none; }
	h1 { font-size: 1.5rem; margin: 16px 0 24px; }
	h2 { font-size: 1rem; font-weight: 600; margin-bottom: 12px; color: var(--text-secondary); }
	.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 16px; }
	.loading { color: var(--text-muted); }
	.status-ok { color: var(--success); font-weight: 600; margin-bottom: 8px; }
	.status-warn { color: var(--warning); font-weight: 600; margin-bottom: 8px; }
	.error { color: var(--danger); font-size: 0.85rem; }
	.hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 8px; }
	.hint.warn { color: var(--warning); }
	.hint code { background: var(--surface); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
	.json { background: var(--surface); padding: 12px; border-radius: var(--radius-sm); font-size: 0.75rem; font-family: var(--font-mono); overflow-x: auto; margin-top: 8px; white-space: pre-wrap; word-break: break-all; }
	.btn { padding: 10px 18px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--surface); color: var(--text-primary); font-size: 0.85rem; cursor: pointer; margin-top: 12px; transition: all 0.15s; }
	.btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
	.btn-primary:hover { opacity: 0.9; }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-bottom: 12px; }
	.table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; }
	.table td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
	.mono { font-family: var(--font-mono); font-size: 0.78rem; }
</style>
