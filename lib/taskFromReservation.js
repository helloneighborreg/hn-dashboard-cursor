import { getPropertyCode, getPropertyDisplayName, getReservationCode } from './codes';
import { parseIsoWallClockTime, todayIso } from './dates';
import { reservationPropertyRecord, reservationPropertyId } from './hospitable';
import { getChecklistUrl } from './propertyChecklists';
import { petCountFromReservation } from './reservationPets';
import { reservationActsAsCancelled, reservationIsCancelled } from './reservationDates.js';

export { reservationActsAsCancelled, reservationIsCancelled };

const DEFAULT_CHECKOUT_START = '10:00';
const DEFAULT_CHECKIN_TIME = '16:00';
const DUE_TIME = '16:00';

/** Parse check-in date and time from a Hospitable reservation. */
export function parseReservationCheckin(reservation) {
	const checkInRaw = reservation.check_in;
	const dateRaw = checkInRaw || reservation.arrival_date;
	if (!dateRaw) return { checkinDate: null, checkinTime: DEFAULT_CHECKIN_TIME };

	const checkinDate = String(dateRaw).slice(0, 10);
	const checkinTime = checkInRaw
		? (parseIsoWallClockTime(checkInRaw) || DEFAULT_CHECKIN_TIME)
		: DEFAULT_CHECKIN_TIME;

	return { checkinDate, checkinTime };
}

/** Parse checkout date and guest checkout time from a Hospitable reservation. */
export function parseReservationCheckout(reservation) {
	const checkOutRaw = reservation.check_out;
	const departureRaw = reservation.departure_date;
	const fromCheckOut = checkOutRaw ? String(checkOutRaw).slice(0, 10) : null;
	const fromDeparture = departureRaw ? String(departureRaw).slice(0, 10) : null;

	if (!fromCheckOut && !fromDeparture) {
		return { checkoutDate: null, startTime: DEFAULT_CHECKOUT_START };
	}

	// Extensions sometimes update departure_date before check_out (or only one field). Use the later date.
	let checkoutDate = fromCheckOut || fromDeparture;
	if (fromCheckOut && fromDeparture) {
		checkoutDate = fromCheckOut >= fromDeparture ? fromCheckOut : fromDeparture;
	}

	const startTime =
		checkOutRaw && (!fromDeparture || checkoutDate === fromCheckOut)
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

/** Checkout/check-in fields only — used when full task build fails but a task already exists. */
export function buildSchedulePatchFromReservation(reservation) {
	const reservationCode = getReservationCode(reservation);
	if (!reservationCode) return null;

	const { checkinDate, checkinTime } = parseReservationCheckin(reservation);
	const { checkoutDate, startTime } = parseReservationCheckout(reservation);
	if (!checkoutDate) return null;

	return {
		reservation_id: reservationCode,
		hospitable_reservation_id: reservation.id || null,
		property_id: reservationPropertyId(reservation),
		checkin_date: checkinDate,
		checkin_time: checkinTime,
		checkout_date: checkoutDate,
		due_date: checkoutDate,
		due_time: DUE_TIME,
		start_time: startTime,
	};
}

export function buildTaskFromReservation(reservation, property, propMap = {}) {
	const reservationCode = getReservationCode(reservation);
	if (!reservationCode) return null;

	const { checkinDate, checkinTime } = parseReservationCheckin(reservation);
	const { checkoutDate, startTime } = parseReservationCheckout(reservation);
	if (!checkoutDate) return null;

	const prop = property || reservationPropertyRecord(reservation, propMap);
	let propertyCode = getPropertyCode(prop) || '';
	if (!propertyCode) {
		const propertyId = reservationPropertyId(reservation);
		if (propertyId && propMap[propertyId]) {
			propertyCode = getPropertyCode(propMap[propertyId]) || '';
		}
	}
	const propertyName = getPropertyDisplayName(prop) || getPropertyDisplayName(propMap[reservationPropertyId(reservation)]) || propertyCode;
	if (!propertyCode) return null;
	const guestName = guestNameFromReservation(reservation);
	const petCount = petCountFromReservation(reservation);

	const draft = {
		reservation_id: reservationCode,
		hospitable_reservation_id: reservation.id || null,
		property_id: reservationPropertyId(reservation),
		property_name: propertyName,
		guest_name: guestName,
		has_pets: petCount > 0,
		pet_count: petCount,
		checklist_url: getChecklistUrl(propertyCode),
		checkin_date: checkinDate,
		checkin_time: checkinTime,
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
	};
}

export function reservationEligibleForTask(reservation) {
	if (!getReservationCode(reservation)) return false;
	if (reservationActsAsCancelled(reservation)) return false;
	return Boolean(parseReservationCheckout(reservation).checkoutDate);
}

/** True when guest checkout date is before today (turnover window has passed). */
export function isPastTurnoverCheckout(reservation, today = todayIso()) {
	const { checkoutDate } = parseReservationCheckout(reservation);
	return Boolean(checkoutDate && checkoutDate < today);
}
