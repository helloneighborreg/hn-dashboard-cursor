/** YYYY-MM-DD check-in from a Hospitable reservation row. */
export function reservationCheckInDate(reservation) {
	return (reservation?.check_in || reservation?.arrival_date || '').slice(0, 10) || null;
}

/** YYYY-MM-DD check-out from a Hospitable reservation row. */
export function reservationCheckOutDate(reservation) {
	return (reservation?.check_out || reservation?.departure_date || '').slice(0, 10) || null;
}

export function reservationIsCancelled(reservation) {
	const status = reservation?.status;
	return status === 'cancelled' || status === 'declined';
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

export function groupReservationsByTimeline(reservations, today = new Date().toISOString().slice(0, 10)) {
	const groups = { future: [], active: [], past: [], cancelled: [] };
	for (const reservation of reservations) {
		if (reservationIsCancelled(reservation)) {
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
