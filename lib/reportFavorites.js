import { REPORT_TYPES } from './reportDefinitions';

const STORAGE_KEY = 'hn_report_favorites';

const VALID_IDS = new Set(REPORT_TYPES.map((r) => r.id));

function normalizeIds(ids) {
	if (!Array.isArray(ids)) return [];
	return ids.filter((id) => VALID_IDS.has(id));
}

export function readReportFavorites() {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		return normalizeIds(JSON.parse(raw));
	} catch {
		return [];
	}
}

export function writeReportFavorites(ids) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeIds(ids)));
	} catch {
		/* ignore */
	}
}

export function toggleReportFavorite(ids, reportId) {
	const set = new Set(normalizeIds(ids));
	if (set.has(reportId)) set.delete(reportId);
	else set.add(reportId);
	return REPORT_TYPES.map((r) => r.id).filter((id) => set.has(id));
}
