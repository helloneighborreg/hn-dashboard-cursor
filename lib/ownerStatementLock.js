import { verifyAdminPassword } from './auth';
import { getOwnerStatementInclusionForReservation } from './db';

export const OWNER_STATEMENT_LOCKED_ERROR = 'Admin password required to edit this reservation.';

export async function isOwnerStatementReservationLocked(property_id, reservation_id) {
	const row = await getOwnerStatementInclusionForReservation(property_id, reservation_id);
	return Boolean(row);
}

export async function assertCanEditOwnerStatementReservation({
	property_id,
	reservation_id,
	admin_password,
}) {
	const locked = await isOwnerStatementReservationLocked(property_id, reservation_id);
	if (!locked) return;

	const ok = await verifyAdminPassword(admin_password);
	if (!ok) {
		const err = new Error(OWNER_STATEMENT_LOCKED_ERROR);
		err.status = 403;
		throw err;
	}
}
