/** Visual styles for task types — left accent on rows/cards and optional badges. */
export const TASK_TYPE_STYLES = {
	turnover: {
		label: 'Turnover',
		rowClass: 'border-l-[3px] border-l-brand-500',
		badgeClass: 'bg-brand-50 text-brand-700',
	},
	maintenance: {
		label: 'Maintenance',
		rowClass: 'border-l-[3px] border-l-amber-500',
		badgeClass: 'bg-amber-50 text-amber-800',
	},
	inspection: {
		label: 'Inspection',
		rowClass: 'border-l-[3px] border-l-violet-500',
		badgeClass: 'bg-violet-50 text-violet-700',
	},
	other: {
		label: 'Other',
		rowClass: 'border-l-[3px] border-l-gray-300',
		badgeClass: 'bg-gray-100 text-muted',
	},
};

export function getTaskTypeStyle(type) {
	return TASK_TYPE_STYLES[type] || TASK_TYPE_STYLES.other;
}

export function taskTypeLabel(type) {
	return getTaskTypeStyle(type).label;
}
