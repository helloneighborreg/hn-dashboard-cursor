/** Parse Hospitable reservation host financials — one column per normalized fee category. */

const MONTH_NAMES = 'January|February|March|April|May|June|July|August|September|October|November|December';

const COLUMN_ORDER = [
	'Accommodation',
	'Cleaning Fee',
	'Pet Fee',
	'Extra Guest Fee',
	'Lodging Taxes',
	'Sec Dep Paid',
	'Promotions',
	'Resolutions',
	'Host Service Fee',
];

function cents(value) {
	if (value == null) return 0;
	if (typeof value === 'number') return value / 100;
	if (typeof value === 'object' && value.amount != null) return value.amount / 100;
	return 0;
}

function feeLabel(fee, fallback = 'Fee') {
	return (fee?.label || fee?.type || fallback).trim();
}

function isAccommodationLabel(label) {
	const text = label.trim();
	if (/^accommodation$/i.test(text)) return true;
	if (/^\d{4}-\d{2}-\d{2}(\s*\(\d+\s*nights?\))?$/i.test(text)) return true;
	if (new RegExp(`^(${MONTH_NAMES})\\s+\\d{4}(\\s+Add On)?$`, 'i').test(text)) return true;
	return false;
}

/** @returns {string|null} normalized column name, or null to exclude */
export function normalizeFeeColumnLabel(rawLabel) {
	const label = (rawLabel || '').trim();
	if (!label) return null;

	if (/^cleaning fee\s*-?\s*deposit$/i.test(label)) return null;
	if (/^deposit$/i.test(label)) return null;
	if (/^0 nights$/i.test(label)) return null;

	if (isAccommodationLabel(label)) return 'Accommodation';

	if (/^lodging taxes?(\s+you remit)?$/i.test(label)) return 'Lodging Taxes';
	if (/^pass-?through taxes?$/i.test(label)) return 'Lodging Taxes';
	if (/^state of iowa hotel tax$/i.test(label)) return 'Lodging Taxes';
	if (/^state of iowa sales tax$/i.test(label)) return 'Lodging Taxes';

	if (/^paid to vrbo$/i.test(label)) return 'Host Service Fee';
	if (/^host service fee$/i.test(label)) return 'Host Service Fee';

	if (/^resolution payout(\b|\s|\()/i.test(label)) return 'Resolutions';
	if (/^resolution adjustment$/i.test(label)) return 'Resolutions';

	if (/^security deposit$/i.test(label)) return 'Sec Dep Paid';

	if (/^promotion discount$/i.test(label)) return 'Promotions';

	if (/^cleaning fee$/i.test(label)) return 'Cleaning Fee';
	if (/^pet fee$/i.test(label)) return 'Pet Fee';
	if (/^extra[_ ]guest[_ ]fee$/i.test(label)) return 'Extra Guest Fee';

	return label;
}

function addFee(fees, rawLabel, amount) {
	if (!amount) return;
	const column = normalizeFeeColumnLabel(rawLabel);
	if (!column) return;
	fees[column] = (fees[column] || 0) + amount;
}

export function sortFeeColumnKeys(keys) {
	return [...keys].sort((a, b) => {
		const ai = COLUMN_ORDER.indexOf(a);
		const bi = COLUMN_ORDER.indexOf(b);
		if (ai !== -1 || bi !== -1) {
			return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
		}
		const aDeduction = /host service fee|promotion|discount|refund/i.test(a);
		const bDeduction = /host service fee|promotion|discount|refund/i.test(b);
		if (aDeduction !== bDeduction) return aDeduction ? 1 : -1;
		return a.localeCompare(b);
	});
}

export function collectFeeColumnKeys(reservations) {
	const keys = new Set();
	for (const row of reservations || []) {
		for (const label of Object.keys(row.fees_by_label || {})) {
			keys.add(label);
		}
	}
	return sortFeeColumnKeys([...keys]);
}

function addLineItem(fees, fee, { signedHostFee = false, forceNegative = false } = {}) {
	const raw = cents(fee);
	if (!raw) return;

	let amount = raw;
	if (signedHostFee) {
		amount = raw < 0 ? raw : -Math.abs(raw);
	} else if (forceNegative) {
		amount = -Math.abs(raw);
	} else {
		amount = Math.abs(raw);
	}

	addFee(fees, feeLabel(fee), amount);
}

/**
 * @param {object|null|undefined} fin - reservation.financials.host
 */
export function parseHostFinancials(fin) {
	if (!fin) {
		return { revenue: 0, fees_by_label: {} };
	}

	const fees = {};

	if (fin.accommodation || fin.accommodation_fare) {
		addFee(fees, 'Accommodation', cents(fin.accommodation ?? fin.accommodation_fare));
	} else {
		for (const night of fin.accommodation_breakdown || []) {
			addLineItem(fees, night);
		}
	}

	for (const fee of fin.guest_fees || []) {
		addLineItem(fees, fee);
	}

	if (Array.isArray(fin.taxes)) {
		for (const tax of fin.taxes) {
			addLineItem(fees, tax);
		}
	} else if (fin.taxes?.total) {
		addLineItem(fees, fin.taxes.total, { forceNegative: false });
	}

	for (const fee of fin.host_fees || []) {
		addLineItem(fees, fee, { signedHostFee: true });
	}

	for (const item of fin.discounts || []) {
		addLineItem(fees, item, { forceNegative: true });
	}

	for (const item of fin.adjustments || []) {
		addLineItem(fees, item);
	}

	return {
		revenue: cents(fin.revenue),
		fees_by_label: fees,
	};
}
