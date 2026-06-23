import { getPropertyGeolocation } from './propertyGeolocations';

export const CHECKLIST_LOCATION_REQUIRED_MESSAGE = "Location Required.  This Is Why We Apparently Can't Have Nice Things. 🙄";

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in meters between two WGS84 points. */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
	const toRad = (deg) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2
		+ Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoordinate(value) {
	if (value == null || value === '') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

/** True when the user position is within the property geofence. */
export function isWithinGeofence(userLat, userLng, target) {
	if (!target) return true;
	const lat = parseCoordinate(userLat);
	const lng = parseCoordinate(userLng);
	if (lat == null || lng == null) return false;
	const distanceM = haversineDistanceMeters(lat, lng, target.lat, target.lng);
	return distanceM <= target.radiusM;
}

/** Server-side validation for checklist open/submit. */
export function validateChecklistGeofence({ latitude, longitude, propertyCode }) {
	const target = getPropertyGeolocation(propertyCode);
	if (!target) {
		return { ok: true, skipped: true };
	}

	const lat = parseCoordinate(latitude);
	const lng = parseCoordinate(longitude);
	if (lat == null || lng == null) {
		return {
			ok: false,
			error: CHECKLIST_LOCATION_REQUIRED_MESSAGE,
			radiusM: target.radiusM,
		};
	}

	const distanceM = haversineDistanceMeters(lat, lng, target.lat, target.lng);
	if (distanceM > target.radiusM) {
		return {
			ok: false,
			error: CHECKLIST_LOCATION_REQUIRED_MESSAGE,
			distanceM,
			radiusM: target.radiusM,
			target,
		};
	}

	return {
		ok: true,
		distanceM,
		radiusM: target.radiusM,
		target,
	};
}
