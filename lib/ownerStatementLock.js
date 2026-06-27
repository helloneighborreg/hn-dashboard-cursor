import { verifyAdminPassword } from './auth';
import {
	getOwnerStatementApprovalsForProperties,
	getOwnerStatementCashInclusionForItem,
	getOwnerStatementInclusionForReservation,
} from './db';
import {
	buildStatementLockMaps,
	mapApprovedReservationLocks,
	ownerStatementCashItemKey,
} from './ownerStatementReport';

export const OWNER_STATEMENT_LOCKED_ERROR = 'Admin password required to edit this reservation.';
export const OWNER_STATEMENT_ITEM_LOCKED_ERROR = 'This item is on an approved owner statement and cannot be edited.';

export async function isOwnerStatementReservationLocked(property_id, reservation_id) {
	const approvals = await getOwnerStatementApprovalsForProperties([property_id]);
	const locks = mapApprovedReservationLocks(approvals);
	if (locks.has(`${property_id}:${reservation_id}`)) return true;

	const row = await getOwnerStatementInclusionForReservation(property_id, reservation_id);
	return Boolean(row);
}

export async function isOwnerStatementCashItemLocked(property_id, item_id, item_source) {
	const inclusion = await getOwnerStatementCashInclusionForItem(property_id, item_id, item_source);
	if (inclusion) return true;

	const approvals = await getOwnerStatementApprovalsForProperties([property_id]);
	const { cashLocks } = buildStatementLockMaps({ approvals });
	return cashLocks.has(ownerStatementCashItemKey(property_id, item_id, item_source));
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

export async function assertCanEditOwnerStatementCashItem({
	property_id,
	item_id,
	item_source,
	admin_password,
}) {
	const locked = await isOwnerStatementCashItemLocked(property_id, item_id, item_source);
	if (!locked) return;

	const ok = await verifyAdminPassword(admin_password);
	if (!ok) {
		const err = new Error(OWNER_STATEMENT_ITEM_LOCKED_ERROR);
		err.status = 403;
		throw err;
	}
}
