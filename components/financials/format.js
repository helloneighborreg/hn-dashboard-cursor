export const CHART_COLORS = ['#5B9AB8', '#3E7F9A', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function fmt$(n) {
	if (n == null) return '—';
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(n);
}

/** Report tables — always $ with 2 decimals; negatives in parentheses. */
export function fmtReport$(n) {
	if (n == null || n === '') return '$0.00';
	const val = Number(n) || 0;
	const formatted = Math.abs(val).toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	if (val === 0) return '$0.00';
	return val < 0 ? `($${formatted})` : `$${formatted}`;
}

export function fmtPct(n) {
	return `${(n ?? 0).toFixed(1)}%`;
}
