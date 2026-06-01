/** Hospitable exposes guest counts on reservations as guests.pet_count. */
export function petCountFromReservation(reservation) {
	const guests = reservation?.guests;
	if (!guests || typeof guests !== 'object') return 0;

	const raw = guests.pet_count ?? guests.pets ?? guests.petCount;
	const count = Number(raw);
	return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function reservationHasPets(reservation) {
	return petCountFromReservation(reservation) > 0;
}

export function taskHasPets(task) {
	if (!task) return false;
	if (task.has_pets === true || task.has_pets === 'true' || task.has_pets === 't') return true;
	const count = Number(task.pet_count);
	return Number.isFinite(count) && count > 0;
}

export function taskPetLabel(task) {
	const count = Number(task?.pet_count);
	if (Number.isFinite(count) && count > 1) return `${count} pets on reservation`;
	return 'Pet on reservation';
}
