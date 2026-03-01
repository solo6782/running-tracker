/**
 * Couleur par sport (CSS variable name)
 */
const SPORT_COLORS = {
	Run: 'var(--run)',
	VirtualRide: 'var(--ride)',
	'Virtual Ride': 'var(--ride)',
	Ride: 'var(--ride)',
	Swim: 'var(--swim)',
	'Alpine Ski': 'var(--ski)',
	Walk: 'var(--walk)',
	Workout: 'var(--other)',
	Rowing: 'var(--other)'
};

/**
 * Icônes par sport
 */
const SPORT_ICONS = {
	Run: '🏃',
	VirtualRide: '🚴',
	'Virtual Ride': '🚴',
	Ride: '🚴',
	Swim: '🏊',
	'Alpine Ski': '⛷️',
	Walk: '🚶',
	Workout: '💪',
	Rowing: '🚣'
};

export function getSportColor(sportType) {
	return SPORT_COLORS[sportType] || 'var(--other)';
}

export function getSportIcon(sportType) {
	return SPORT_ICONS[sportType] || '🏋️';
}

/**
 * Distance en mètres → affichage km
 */
export function formatDistance(meters) {
	if (!meters) return '—';
	if (meters < 1000) return `${Math.round(meters)}m`;
	return `${(meters / 1000).toFixed(2)}km`;
}

/**
 * Durée en secondes → hh:mm:ss ou mm:ss
 */
export function formatDuration(seconds) {
	if (!seconds) return '—';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);

	if (h > 0) {
		return `${h}h${String(m).padStart(2, '0')}`;
	}
	return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Vitesse m/s → pace min/km (pour running/walk/swim)
 */
export function formatPace(speedMs) {
	if (!speedMs || speedMs === 0) return '—';
	const paceSeconds = 1000 / speedMs;
	const min = Math.floor(paceSeconds / 60);
	const sec = Math.floor(paceSeconds % 60);
	return `${min}:${String(sec).padStart(2, '0')}/km`;
}

/**
 * Vitesse m/s → km/h (pour vélo/ski)
 */
export function formatSpeed(speedMs) {
	if (!speedMs) return '—';
	return `${(speedMs * 3.6).toFixed(1)}km/h`;
}

/**
 * Retourne pace ou vitesse selon le sport
 */
export function formatSpeedForSport(speedMs, sportType) {
	const paceTypes = ['Run', 'Walk', 'Swim'];
	if (paceTypes.includes(sportType)) {
		return formatPace(speedMs);
	}
	return formatSpeed(speedMs);
}

/**
 * Fréquence cardiaque
 */
export function formatHR(hr) {
	if (!hr) return '—';
	return `${Math.round(hr)}bpm`;
}

/**
 * Date → format lisible
 */
export function formatDate(dateStr) {
	if (!dateStr) return '—';
	const date = new Date(dateStr);
	return date.toLocaleDateString('fr-FR', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

/**
 * Date → format court
 */
export function formatDateShort(dateStr) {
	if (!dateStr) return '—';
	const date = new Date(dateStr);
	return date.toLocaleDateString('fr-FR', {
		day: 'numeric',
		month: 'short'
	});
}

/**
 * Feeling smiley (1-7)
 */
const FEELING_SMILEYS = ['', '😫', '😣', '😐', '🙂', '😊', '😄', '😁'];

export function getFeelingEmoji(value) {
	return FEELING_SMILEYS[value] || '';
}
