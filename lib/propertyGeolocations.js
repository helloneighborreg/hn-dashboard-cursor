import { resolvePropertyCode } from './codes';
import { CHECKLIST_FORM_BY_PROPERTY, usesInAppChecklist } from './propertyChecklists';

/** Cascades complex — all CJC units share this address. */
const CASCADES_COMPLEX = {
	lat: 41.5555828,
	lng: -93.8212495,
	label: '8350 Cascade Avenue, West Des Moines, IA',
};

const CJC_PROPERTY_LOCATIONS = Object.fromEntries(
	Object.keys(CHECKLIST_FORM_BY_PROPERTY)
		.filter((code) => CHECKLIST_FORM_BY_PROPERTY[code] === 'cjc')
		.map((code) => [code, CASCADES_COMPLEX]),
);

export function defaultGeofenceRadiusM() {
	const raw = process.env.CJC_CHECKLIST_GEOFENCE_RADIUS_M
		?? process.env.NEXT_PUBLIC_CJC_CHECKLIST_GEOFENCE_RADIUS_M;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : 150;
}

/** Geofence target for in-app checklist properties, or null if not configured. */
export function getPropertyGeolocation(propertyCode) {
	const code = resolvePropertyCode(propertyCode);
	if (!code || !usesInAppChecklist(code)) return null;

	const normalized = code.toUpperCase();
	const base = CJC_PROPERTY_LOCATIONS[normalized];
	if (!base) return null;

	return {
		propertyCode: normalized,
		lat: base.lat,
		lng: base.lng,
		label: base.label,
		radiusM: defaultGeofenceRadiusM(),
	};
}
