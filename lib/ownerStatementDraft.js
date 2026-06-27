import { applyOwnerStatementItemSelection, isCashItemIncludedInReservations, isStatementCashItemLocked } from './ownerStatementReport';

function reservationAdjustmentsForPicker(reservations = []) {
	const items = [];
	for (const row of reservations) {
		for (const adj of row.adjustment_items || []) {
			items.push({
				...adj,
				kind: 'adjustment',
				property_id: row.property_id,
				property_name: adj.property_name || row.property_name,
			});
		}
	}
	return items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function statementTemplateForProperty(data, propertyId) {
	return (data.statement_templates || data.statements || []).find(
		(s) => s.property_id === propertyId,
	) || {};
}

function buildDraftForProperty(data, propertyId, reservations) {
	const template = statementTemplateForProperty(data, propertyId);
	const cashLocks = data.statement_cash_locks;
	const transactions = (data.additional_items || []).filter(
		(row) => row.property_id === propertyId && row.kind === 'transaction',
	).filter((row) => !isCashItemIncludedInReservations(row, reservations))
		.filter((row) => !isStatementCashItemLocked(row, cashLocks));
	const adjustments = reservationAdjustmentsForPicker(reservations)
		.filter((row) => !isStatementCashItemLocked(row, cashLocks));
	const selection = {
		transactionIds: new Set(),
		adjustmentIds: new Set(),
	};
	const draft = applyOwnerStatementItemSelection({
		property_id: propertyId,
		property_name: template.property_name || reservations[0]?.property_name || 'Property',
		property_label: template.property_label || template.property_name || reservations[0]?.property_name,
		property_address: template.property_address || '',
		property_address_line1: template.property_address_line1 || '',
		property_address_line2: template.property_address_line2 || '',
		recipient: template.recipient || { name: '', address: '', address_line1: '', address_line2: '' },
		statement_period: data.statement_period || template.statement_period || 'Statement',
		notes: template.notes || '',
		reservations,
		transactions,
		adjustments,
	}, selection);

	return {
		...draft,
		available_transactions: transactions,
		available_adjustments: adjustments,
	};
}

/** Build owner statement preview payloads from selected reservation rows. */
export function buildDraftOwnerStatements(data, selectedReservationIds) {
	const idSet = new Set(selectedReservationIds);
	const selected = (data.reservations || []).filter(
		(row) => idSet.has(row.id) && !row.statement_locked,
	);
	if (!selected.length) return [];

	const byProperty = new Map();
	for (const row of selected) {
		if (!row.property_id) continue;
		if (!byProperty.has(row.property_id)) byProperty.set(row.property_id, []);
		byProperty.get(row.property_id).push(row);
	}

	const statements = [];
	for (const [propertyId, reservations] of byProperty) {
		statements.push(buildDraftForProperty(data, propertyId, reservations));
	}

	return statements.sort((a, b) => String(a.property_name).localeCompare(String(b.property_name)));
}

/** Build blank owner statement previews (no reservations) for the given properties. */
export function buildBlankDraftOwnerStatements(data, propertyIds) {
	if (!propertyIds?.length) return [];

	return propertyIds
		.map((propertyId) => buildDraftForProperty(data, propertyId, []))
		.filter((statement) => statement.property_id)
		.sort((a, b) => String(a.property_name).localeCompare(String(b.property_name)));
}

export function buildDefaultItemSelections(statements = []) {
	const selections = {};
	for (const statement of statements) {
		selections[statement.property_id] = {
			transactionIds: new Set(),
			adjustmentIds: new Set(),
		};
	}
	return selections;
}

export function toggleItemSelection(selection, row, included) {
	const next = {
		transactionIds: new Set(selection?.transactionIds || []),
		adjustmentIds: new Set(selection?.adjustmentIds || []),
	};
	const bucket = row.kind === 'adjustment' ? next.adjustmentIds : next.transactionIds;
	if (included) bucket.add(row.id);
	else bucket.delete(row.id);
	return next;
}
