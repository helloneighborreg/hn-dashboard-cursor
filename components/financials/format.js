export const CHART_COLORS = ['#5B9AB8', '#3E7F9A', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function fmt$(n) {
	if (n == null) return '—';
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function fmtPct(n) {
	return `${(n ?? 0).toFixed(1)}%`;
}
