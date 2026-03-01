<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getSportColor, getSportIcon } from '$lib/format.js';

	export let data;

	let chartsReady = false;
	let Chart;

	// Canvas refs
	let monthlyDistCanvas;
	let monthlyCountCanvas;
	let paceCanvas;
	let hrCanvas;
	let sportDoughnutCanvas;
	let hrZoneCanvas;
	let weeklyCanvas;
	let elevationCanvas;

	// Store chart instances for cleanup
	let charts = [];

	function destroyCharts() {
		for (const c of charts) {
			if (c) c.destroy();
		}
		charts = [];
	}

	function sportFilterChange(e) {
		const url = new URL($page.url);
		if (e.target.value === 'all') {
			url.searchParams.delete('sport');
		} else {
			url.searchParams.set('sport', e.target.value);
		}
		goto(url.toString());
	}

	// Chart.js global config
	function setupDefaults() {
		Chart.defaults.color = '#8888a0';
		Chart.defaults.borderColor = 'rgba(42, 42, 58, 0.6)';
		Chart.defaults.font.family = "'DM Sans', sans-serif";
		Chart.defaults.font.size = 11;
		Chart.defaults.plugins.legend.display = false;
		Chart.defaults.plugins.tooltip.backgroundColor = '#1a1a26';
		Chart.defaults.plugins.tooltip.borderColor = '#333346';
		Chart.defaults.plugins.tooltip.borderWidth = 1;
		Chart.defaults.plugins.tooltip.padding = 10;
		Chart.defaults.plugins.tooltip.cornerRadius = 8;
		Chart.defaults.plugins.tooltip.titleFont = { family: "'DM Sans', sans-serif", size: 12, weight: '600' };
		Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 11 };
		Chart.defaults.scale.grid = { color: 'rgba(42, 42, 58, 0.4)', lineWidth: 0.5 };
	}

	function createCharts() {
		if (data.empty || !Chart) return;
		destroyCharts();

		// ----- Monthly Distance Bar -----
		if (monthlyDistCanvas && data.monthly.length > 0) {
			charts.push(new Chart(monthlyDistCanvas, {
				type: 'bar',
				data: {
					labels: data.monthly.map(m => m.label),
					datasets: [{
						data: data.monthly.map(m => +(m.distance / 1000).toFixed(1)),
						backgroundColor: data.monthly.map((_, i) =>
							i === data.monthly.length - 1 ? '#6c5ce7' : 'rgba(108, 92, 231, 0.3)'
						),
						borderRadius: 4,
						borderSkipped: false
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						tooltip: {
							callbacks: {
								label: (ctx) => `${ctx.parsed.y} km`
							}
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: { callback: v => v + ' km' }
						}
					}
				}
			}));
		}

		// ----- Monthly Activity Count -----
		if (monthlyCountCanvas && data.monthly.length > 0) {
			charts.push(new Chart(monthlyCountCanvas, {
				type: 'bar',
				data: {
					labels: data.monthly.map(m => m.label),
					datasets: [{
						data: data.monthly.map(m => m.count),
						backgroundColor: data.monthly.map((_, i) =>
							i === data.monthly.length - 1 ? '#00d2a0' : 'rgba(0, 210, 160, 0.3)'
						),
						borderRadius: 4,
						borderSkipped: false
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						tooltip: {
							callbacks: {
								label: (ctx) => `${ctx.parsed.y} séances`
							}
						}
					},
					scales: {
						y: { beginAtZero: true, ticks: { stepSize: 1 } }
					}
				}
			}));
		}

		// ----- Pace Trend (scatter with trend line) -----
		if (paceCanvas) {
			const paceData = data.recentActivities
				.filter(a => a.pace && a.pace > 0 && a.pace < 900)
				.map(a => ({ x: a.date, y: +(a.pace / 60).toFixed(2) }));

			if (paceData.length > 0) {
				charts.push(new Chart(paceCanvas, {
					type: 'scatter',
					data: {
						datasets: [{
							data: paceData,
							backgroundColor: 'rgba(108, 92, 231, 0.5)',
							pointRadius: 4,
							pointHoverRadius: 6
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							tooltip: {
								callbacks: {
									label: (ctx) => {
										const min = Math.floor(ctx.parsed.y);
										const sec = Math.round((ctx.parsed.y - min) * 60);
										return `${min}:${String(sec).padStart(2, '0')}/km`;
									}
								}
							}
						},
						scales: {
							x: {
								type: 'category',
								ticks: {
									maxTicksLimit: 10,
									maxRotation: 45
								}
							},
							y: {
								reverse: true,
								ticks: {
									callback: v => {
										const min = Math.floor(v);
										const sec = Math.round((v - min) * 60);
										return `${min}:${String(sec).padStart(2, '0')}`;
									}
								},
								title: { display: true, text: 'min/km' }
							}
						}
					}
				}));
			}
		}

		// ----- HR Trend -----
		if (hrCanvas) {
			const hrData = data.recentActivities.filter(a => a.hr);
			if (hrData.length > 0) {
				charts.push(new Chart(hrCanvas, {
					type: 'line',
					data: {
						labels: hrData.map(a => a.date),
						datasets: [{
							data: hrData.map(a => Math.round(a.hr)),
							borderColor: '#ff6b6b',
							backgroundColor: 'rgba(255, 107, 107, 0.1)',
							borderWidth: 2,
							pointRadius: 3,
							pointBackgroundColor: '#ff6b6b',
							fill: true,
							tension: 0.3
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							tooltip: {
								callbacks: { label: ctx => `${ctx.parsed.y} bpm` }
							}
						},
						scales: {
							x: { ticks: { maxTicksLimit: 10, maxRotation: 45 } },
							y: {
								ticks: { callback: v => v + ' bpm' },
								title: { display: true, text: 'bpm' }
							}
						}
					}
				}));
			}
		}

		// ----- Sport Doughnut -----
		if (sportDoughnutCanvas && data.sportDistribution.length > 0) {
			const sportColors = {
				Run: '#6c5ce7', Ride: '#00b894', VirtualRide: '#00b894',
				Swim: '#0984e3', Walk: '#ffc048', 'Alpine Ski': '#74b9ff',
				Workout: '#8888a0', Rowing: '#8888a0'
			};
			charts.push(new Chart(sportDoughnutCanvas, {
				type: 'doughnut',
				data: {
					labels: data.sportDistribution.map(s => s.type),
					datasets: [{
						data: data.sportDistribution.map(s => s.count),
						backgroundColor: data.sportDistribution.map(s => sportColors[s.type] || '#8888a0'),
						borderWidth: 0,
						spacing: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: '65%',
					plugins: {
						legend: { display: true, position: 'right', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' } },
						tooltip: {
							callbacks: {
								label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / data.totalActivities * 100)}%)`
							}
						}
					}
				}
			}));
		}

		// ----- HR Zone Distribution -----
		if (hrZoneCanvas) {
			const totalHr = data.hrZones.reduce((a, b) => a + b, 0);
			if (totalHr > 0) {
				charts.push(new Chart(hrZoneCanvas, {
					type: 'bar',
					data: {
						labels: ['Z1 (<120)', 'Z2 (120-140)', 'Z3 (140-160)', 'Z4 (160-180)', 'Z5 (>180)'],
						datasets: [{
							data: data.hrZones,
							backgroundColor: ['#74b9ff', '#00d2a0', '#ffc048', '#ff8c42', '#ff6b6b'],
							borderRadius: 4,
							borderSkipped: false
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						indexAxis: 'y',
						plugins: {
							tooltip: {
								callbacks: {
									label: ctx => `${ctx.parsed.x} activités (${Math.round(ctx.parsed.x / totalHr * 100)}%)`
								}
							}
						},
						scales: {
							x: { beginAtZero: true, ticks: { stepSize: 1 } }
						}
					}
				}));
			}
		}

		// ----- Weekly Volume -----
		if (weeklyCanvas && data.weekly.length > 0) {
			// Show last 20 weeks
			const recentWeeks = data.weekly.slice(-20);
			charts.push(new Chart(weeklyCanvas, {
				type: 'bar',
				data: {
					labels: recentWeeks.map(w => w.week.slice(5)),
					datasets: [{
						data: recentWeeks.map(w => +(w.distance / 1000).toFixed(1)),
						backgroundColor: recentWeeks.map((_, i) =>
							i === recentWeeks.length - 1 ? '#6c5ce7' : 'rgba(108, 92, 231, 0.25)'
						),
						borderRadius: 3,
						borderSkipped: false
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						tooltip: {
							callbacks: { label: ctx => `${ctx.parsed.y} km` }
						}
					},
					scales: {
						x: { ticks: { maxRotation: 45 } },
						y: { beginAtZero: true, ticks: { callback: v => v + ' km' } }
					}
				}
			}));
		}

		// ----- Monthly Elevation -----
		if (elevationCanvas && data.monthly.length > 0) {
			charts.push(new Chart(elevationCanvas, {
				type: 'bar',
				data: {
					labels: data.monthly.map(m => m.label),
					datasets: [{
						data: data.monthly.map(m => Math.round(m.elevation)),
						backgroundColor: data.monthly.map((_, i) =>
							i === data.monthly.length - 1 ? '#ffc048' : 'rgba(255, 192, 72, 0.3)'
						),
						borderRadius: 4,
						borderSkipped: false
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						tooltip: {
							callbacks: { label: ctx => `${ctx.parsed.y} m D+` }
						}
					},
					scales: {
						y: { beginAtZero: true, ticks: { callback: v => v + ' m' } }
					}
				}
			}));
		}
	}

	onMount(async () => {
		const module = await import('chart.js');
		Chart = module.Chart;
		const { BarController, LineController, ScatterController, DoughnutController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, Filler } = module;
		Chart.register(BarController, LineController, ScatterController, DoughnutController, BarElement, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

		setupDefaults();
		chartsReady = true;
		createCharts();

		return () => destroyCharts();
	});

	// Recreate charts when data changes (sport filter)
	$: if (chartsReady && data) {
		// Small delay to ensure canvases are rendered
		setTimeout(createCharts, 50);
	}
</script>

<svelte:head>
	<title>Graphiques — Running Tracker</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div class="header-top">
			<a href="/dashboard" class="back-link">← Dashboard</a>
			<h1>📊 Graphiques</h1>
		</div>

		<!-- Sport filter -->
		<div class="filter-row">
			<select value={data.sportFilter} on:change={sportFilterChange} class="select">
				<option value="all">Tous les sports</option>
				{#each data.sportTypes as st}
					<option value={st.type}>{getSportIcon(st.type)} {st.type} ({st.count})</option>
				{/each}
			</select>
		</div>
	</header>

	{#if data.error}
		<div class="error-banner">⚠️ {data.error}</div>
	{:else if data.empty}
		<div class="empty-state">
			<p>Pas assez de données pour afficher des graphiques.</p>
		</div>
	{:else}

	<!-- Row 1: Monthly Distance + Activity Count -->
	<div class="chart-grid two-col">
		<div class="chart-card">
			<h3>Distance mensuelle</h3>
			<div class="chart-container">
				<canvas bind:this={monthlyDistCanvas}></canvas>
			</div>
		</div>
		<div class="chart-card">
			<h3>Nombre de séances / mois</h3>
			<div class="chart-container">
				<canvas bind:this={monthlyCountCanvas}></canvas>
			</div>
		</div>
	</div>

	<!-- Row 2: Weekly Volume -->
	<div class="chart-card full">
		<h3>Volume hebdomadaire <span class="chart-sub">(20 dernières semaines)</span></h3>
		<div class="chart-container wide">
			<canvas bind:this={weeklyCanvas}></canvas>
		</div>
	</div>

	<!-- Row 3: Pace + HR trend -->
	<div class="chart-grid two-col">
		<div class="chart-card">
			<h3>Évolution de l'allure</h3>
			<div class="chart-container">
				<canvas bind:this={paceCanvas}></canvas>
			</div>
		</div>
		<div class="chart-card">
			<h3>Fréquence cardiaque moyenne</h3>
			<div class="chart-container">
				<canvas bind:this={hrCanvas}></canvas>
			</div>
		</div>
	</div>

	<!-- Row 4: Elevation + HR Zones -->
	<div class="chart-grid two-col">
		<div class="chart-card">
			<h3>Dénivelé mensuel</h3>
			<div class="chart-container">
				<canvas bind:this={elevationCanvas}></canvas>
			</div>
		</div>
		<div class="chart-card">
			<h3>Zones de FC</h3>
			<div class="chart-container">
				<canvas bind:this={hrZoneCanvas}></canvas>
			</div>
		</div>
	</div>

	<!-- Row 5: Sport Doughnut -->
	<div class="chart-card full narrow">
		<h3>Répartition par sport</h3>
		<div class="chart-container doughnut">
			<canvas bind:this={sportDoughnutCanvas}></canvas>
		</div>
	</div>

	{/if}
</div>

<style>
	.page {
		max-width: 1000px;
		margin: 0 auto;
		padding: 24px 16px 60px;
	}

	.page-header { margin-bottom: 24px; }
	.header-top {
		display: flex;
		align-items: baseline;
		gap: 16px;
		margin-bottom: 12px;
	}
	.back-link {
		color: var(--text-secondary);
		font-size: 0.85rem;
		text-decoration: none;
	}
	.back-link:hover { color: var(--accent-light); }
	h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }

	.filter-row { display: flex; gap: 8px; }
	.select {
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

	.error-banner {
		background: rgba(255, 107, 107, 0.1);
		border: 1px solid var(--danger);
		border-radius: var(--radius-md);
		padding: 12px 16px;
		color: var(--danger);
	}
	.empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }

	/* Chart grid */
	.chart-grid {
		display: grid;
		gap: 12px;
		margin-bottom: 12px;
	}
	.chart-grid.two-col { grid-template-columns: 1fr 1fr; }

	.chart-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 20px;
	}
	.chart-card.full { margin-bottom: 12px; }
	.chart-card.narrow { max-width: 480px; }

	.chart-card h3 {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}
	.chart-sub {
		font-weight: 400;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.chart-container {
		position: relative;
		height: 220px;
	}
	.chart-container.wide { height: 200px; }
	.chart-container.doughnut { height: 240px; }

	/* Mobile */
	@media (max-width: 700px) {
		.chart-grid.two-col { grid-template-columns: 1fr; }
		.chart-container { height: 200px; }
		.chart-card.narrow { max-width: 100%; }
	}
</style>
