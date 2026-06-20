import { isUncategorized, categoryLabel } from './bookkeepingCategories';
import { fetchJson } from './apiClient';

export function canExcludeTransaction(item) {
	return item?.source === 'bank' && Boolean(item?.id);
}

export async function setTransactionExcluded(id, excluded) {
	const json = await fetchJson(`/api/bank/transactions/${id}`, {
		method: 'PATCH',
		body: { hidden: excluded },
	});
	return json?.data;
}

export function filterTransactionsClient(rows, { search, tab }) {
	let list = rows;
	if (tab === 'needs_review') {
		list = list.filter((tx) => !tx.hidden && !tx.reviewed);
	} else {
		list = list.filter((tx) => !tx.hidden || tab === 'all');
	}
	if (!search?.trim()) return list;
	const q = search.trim().toLowerCase();
	return list.filter((tx) => {
		const hay = [
			tx.description,
			tx.account,
			tx.category,
			categoryLabel(tx.category),
			tx.notes,
		].filter(Boolean).join(' ').toLowerCase();
		return hay.includes(q);
	});
}

export function uniqueAccounts(transactions) {
	const map = new Map();
	for (const tx of transactions) {
		const id = tx.account_id || tx.account || '';
		if (!id) continue;
		if (!map.has(id)) map.set(id, tx.account || id);
	}
	return [...map.entries()].map(([id, label]) => ({ id, label }));
}

export function exportTransactionsCsv(rows, propertyNameById, reservationById = {}) {
	const headers = [
		'Date', 'Account', 'Description', 'Amount', 'Category', 'Property',
		'Reservation', 'Payout amount', 'Notes', 'Reviewed',
	];
	const lines = [headers.join(',')];
	for (const tx of rows) {
		const prop = tx.property_id ? (propertyNameById[tx.property_id] || tx.property_id) : '';
		const res = tx.matched_reservation_id
			? reservationById[tx.matched_reservation_id]
			: null;
		const cells = [
			tx.date,
			tx.account || '',
			`"${String(tx.description || '').replace(/"/g, '""')}"`,
			tx.amount,
			categoryLabel(tx.category) || '',
			prop,
			res ? `${res.code} ${res.guest_name || ''}`.trim() : '',
			tx.matched_payout_amount ?? '',
			`"${String(tx.notes || '').replace(/"/g, '""')}"`,
			tx.reviewed ? 'yes' : 'no',
		];
		lines.push(cells.join(','));
	}
	return lines.join('\n');
}

export function txNeedsReview(tx) {
	return !tx.hidden && !tx.reviewed;
}

export function txIsCategorized(tx) {
	return !isUncategorized(tx.category);
}
