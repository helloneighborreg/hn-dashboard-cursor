/** YYYY-MM-DD check-in from a Hospitable reservation row. */
export function reservationCheckInDate(reservation) {
	return (reservation?.check_in || reservation?.arrival_date || '').slice(0, 10) || null;
}

/** YYYY-MM-DD check-out from a Hospitable reservation row. */
export function reservationCheckOutDate(reservation) {
	return (reservation?.check_out || reservation?.departure_date || '').slice(0, 10) || null;
}

export function reservationIsCancelled(reservation) {
	const status = String(reservation?.status || '').toLowerCase();
	return status === 'cancelled' || status === 'canceled' || status === 'declined';
}

export function reservationIsExpired(reservation) {
	return String(reservation?.status || '').toLowerCase() === 'expired';
}

/**
 * Expired reservations follow the same protocols as cancelled (task removal, excluded
 * from active lists, grouped in the Cancelled tab) but the upstream status stays `expired`.
 */
export function reservationActsAsCancelled(reservation) {
	return reservationIsCancelled(reservation) || reservationIsExpired(reservation);
}

/** Calendar view: only show accepted (confirmed) bookings. */
export function isConfirmedReservation(reservation) {
	return String(reservation?.status || '').toLowerCase() === 'accepted';
}

/**
 * Timeline bucket for reservations page tabs (non-cancelled only).
 * - future: check-in is after today
 * - active: today is on or between check-in and check-out
 * - past: check-out is before today
 */
export function reservationTimelineBucket(reservation, today) {
	const checkIn = reservationCheckInDate(reservation);
	const checkOut = reservationCheckOutDate(reservation);
	if (!checkIn || !checkOut) return 'past';
	if (checkOut < today) return 'past';
	if (checkIn > today) return 'future';
	return 'active';
}

export function sortReservationsForTimeline(reservations, bucket) {
	const list = [...reservations];
	if (bucket === 'past' || bucket === 'cancelled') {
		return list.sort((a, b) =>
			(reservationCheckOutDate(b) || reservationCheckInDate(b) || '')
				.localeCompare(reservationCheckOutDate(a) || reservationCheckInDate(a) || ''),
		);
	}
	return list.sort((a, b) =>
		reservationCheckInDate(a).localeCompare(reservationCheckInDate(b)),
	);
}

export function sortReservationsByCheckInAsc(reservations) {
	return [...reservations].sort((a, b) =>
		(reservationCheckInDate(a) || '').localeCompare(reservationCheckInDate(b) || ''),
	);
}

export function sortReservationsByCheckOutAsc(reservations) {
	return [...reservations].sort((a, b) =>
		(reservationCheckOutDate(a) || '').localeCompare(reservationCheckOutDate(b) || ''),
	);
}

export function groupReservationsByTimeline(reservations, today = new Date().toISOString().slice(0, 10)) {
	const groups = { future: [], active: [], past: [], cancelled: [] };
	for (const reservation of reservations) {
		if (reservationActsAsCancelled(reservation)) {
			groups.cancelled.push(reservation);
			continue;
		}
		const bucket = reservationTimelineBucket(reservation, today);
		groups[bucket].push(reservation);
	}
	groups.future = sortReservationsForTimeline(groups.future, 'future');
	groups.active = sortReservationsForTimeline(groups.active, 'active');
	groups.past = sortReservationsForTimeline(groups.past, 'past');
	groups.cancelled = sortReservationsForTimeline(groups.cancelled, 'cancelled');
	return groups;
}
