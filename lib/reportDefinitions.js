/** Report catalog — metadata for UI; not stored in the database. */

export const REPORT_TYPES = [
	{
		id: 'owner-statements',
		label: 'Owner Statement',
		description: 'Per-reservation owner statement with revenue, fees, and payout balances — select reservations or generate a blank statement for one property, then add manual transactions when generating.',
	},
	{
		id: 'net-cash-flow',
		label: 'Net Cash Flow',
		description: 'Cash-basis revenue and expenses, including loan/mortgage payments and capital expenditures.',
	},
	{
		id: 'noi',
		label: 'Net Operating Income (NOI)',
		description: 'Operating revenue and expenses before loan/mortgage payments and capital expenditures.',
	},
	{
		id: 'inflow-outflow',
		label: 'Total Inflow & Outflow',
		description: 'All cash movement including loan/mortgage, capex, internal transfers, and uncategorized transactions.',
	},
	{
		id: 'balance-sheet',
		label: 'Balance Sheet',
		description: 'Statement of assets, liabilities, and shareholder equity.',
	},
	{
		id: 'schedule-e',
		label: 'Schedule E',
		description: 'Rental income and expenses grouped by IRS Schedule E category.',
	},
];

export function normalizeReportId(value) {
	const id = String(value || '').toLowerCase().trim();
	return REPORT_TYPES.some((r) => r.id === id) ? id : null;
}

export function reportById(id) {
	if (!id) return null;
	return REPORT_TYPES.find((r) => r.id === id) || null;
}
