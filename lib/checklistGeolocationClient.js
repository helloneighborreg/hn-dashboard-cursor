import { CHECKLIST_LOCATION_REQUIRED_MESSAGE, haversineDistanceMeters } from './geofence';

function readPosition() {
	return new Promise((resolve, reject) => {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			reject(new Error(CHECKLIST_LOCATION_REQUIRED_MESSAGE));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => resolve(pos),
			() => {
				reject(new Error(CHECKLIST_LOCATION_REQUIRED_MESSAGE));
			},
			{
				enableHighAccuracy: true,
				timeout: 20_000,
				maximumAge: 0,
			},
		);
	});
}

/** Read GPS and ensure the user is within the property geofence. */
export async function captureChecklistLocation(geolocationTarget) {
	if (!geolocationTarget) return null;

	const pos = await readPosition();
	const { latitude, longitude, accuracy } = pos.coords;
	const distanceM = haversineDistanceMeters(
		latitude,
		longitude,
		geolocationTarget.lat,
		geolocationTarget.lng,
	);

	if (distanceM > geolocationTarget.radiusM) {
		throw new Error(CHECKLIST_LOCATION_REQUIRED_MESSAGE);
	}

	return {
		latitude,
		longitude,
		accuracy: accuracy ?? null,
		capturedAt: new Date().toISOString(),
		distanceM,
	};
}

export { readPosition, CHECKLIST_LOCATION_REQUIRED_MESSAGE };
