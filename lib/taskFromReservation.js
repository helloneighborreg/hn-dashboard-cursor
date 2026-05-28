import { getPropertyCode, getPropertyDisplayName, getReservationCode } from './codes';
import { parseIsoWallClockTime } from './dates';
import { reservationPropertyRecord, reservationPropertyId } from './hospitable';
import { getChecklistUrl } from './propertyChecklists';

const DEFAULT_CHECKOUT_START = '10:00';
const DUE_TIME = '16:00';

/** Parse checkout date and guest checkout time from a Hospitable reservation. */
export function parseReservationCheckout(reservation) {
	const checkOutRaw = reservation.check_out;
	const dateRaw = checkOutRaw || reservation.departure_date;
	if (!dateRaw) return { checkoutDate: null, startTime: DEFAULT_CHECKOUT_START };

	const checkoutDate = String(dateRaw).slice(0, 10);
	// Use check_out's embedded local time (e.g. 10:00-05:00). departure_date is often midnight.
	const startTime = checkOutRaw
		? (parseIsoWallClockTime(checkOutRaw) || DEFAULT_CHECKOUT_START)
		: DEFAULT_CHECKOUT_START;

	return { checkoutDate, startTime };
}

export function guestNameFromReservation(reservation) {
	if (reservation.guest?.first_name || reservation.guest?.last_name) {
		return [reservation.guest.first_name, reservation.guest.last_name].filter(Boolean).join(' ');
	}
	return reservation.guest?.name || reservation.guest_name || '';
}

export function buildTaskFromReservation(reservation, property) {
	const reservationCode = getReservationCode(reservation);
	if (!reservationCode) return null;

	const { checkoutDate, startTime } = parseReservationCheckout(reservation);
	if (!checkoutDate) return null;

	const prop = property || reservationPropertyRecord(reservation);
	const propertyCode = getPropertyCode(prop) || '';
	const propertyName = getPropertyDisplayName(prop) || propertyCode;
	if (!propertyCode) return null;
	const guestName = guestNameFromReservation(reservation);

	const draft = {
		reservation_id: reservationCode,
		property_id: reservationPropertyId(reservation),
		property_name: propertyName,
		guest_name: guestName,
		checklist_url: getChecklistUrl(propertyCode),
		due_date: checkoutDate,
		due_time: DUE_TIME,
		checkout_date: checkoutDate,
		start_time: startTime,
		type: 'turnover',
		notes: null,
	};

	return {
		...draft,
		title: `${reservationCode} - ${propertyName}`,
		description: guestName || '',
		/** Used only when upserting — matches legacy rows keyed by Hospitable UUID. */
		hospitable_reservation_id: reservation.id,
	};
}

export function reservationEligibleForTask(reservation) {
	if (!getReservationCode(reservation)) return false;
	if (reservationIsCancelled(reservation)) return false;
	return Boolean(parseReservationCheckout(reservation).checkoutDate);
}

export function reservationIsCancelled(reservation) {
	const status = reservation?.status;
	return status === 'cancelled' || status === 'declined';
}
