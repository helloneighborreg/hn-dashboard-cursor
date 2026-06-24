export const ASSIGNEES = ['Brandi Drieslein', 'Josiah Burton', 'Rachel Jackson', 'Other'];

export const TASK_STATUSES = ['unassigned', 'assigned', 'completed', 'under_review'];

export function formatTaskStatus(status) {
	if (!status) return '—';
	if (status === 'unassigned') return 'Unassigned';
	if (status === 'under_review') return 'Review';
	return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isTaskUnderReview(task) {
	return task?.status === 'under_review';
}

export function isTaskFinished(task) {
	return task?.status === 'under_review' || task?.status === 'completed';
}

/** True when task has an assignee (not necessarily status === 'assigned'). */
export function isTaskAssigned(task) {
	return Boolean(task?.assignee?.trim());
}

export function statusFromAssignee(assignee) {
	return assignee?.trim() ? 'assigned' : 'unassigned';
}

import { todayIso } from './dates';

export function taskIsOverdue(task) {
	const today = todayIso();
	return Boolean(task?.due_date && task.due_date < today && !isTaskFinished(task));
}

/** UI indicator: overdue → exclamation; else completed / under review / assigned / unassigned. */
export function getTaskStatusIndicator(task) {
	if (task?.status === 'completed') {
		return { kind: 'completed', label: 'Completed' };
	}
	if (task?.status === 'under_review') {
		return { kind: 'under_review', label: 'Review' };
	}
	if (taskIsOverdue(task)) {
		return { kind: 'overdue', label: 'Overdue' };
	}
	if (isTaskAssigned(task)) {
		return { kind: 'assigned', label: 'Assigned' };
	}
	return { kind: 'unassigned', label: 'Unassigned' };
}

/** Count tasks in the current list by indicator kind (mutually exclusive per task). */
export function countTasksByIndicator(tasks) {
	const counts = { unassigned: 0, assigned: 0, under_review: 0, completed: 0, overdue: 0 };
	for (const task of tasks || []) {
		counts[getTaskStatusIndicator(task).kind] += 1;
	}
	return counts;
}

/** Cleaner-facing label + hint for submitted/approved tasks (null otherwise). */
export function getCleanerTaskStatusMessage(task) {
	if (task?.status === 'under_review') {
		return {
			label: 'Review',
			hint: 'Checklist received — waiting for admin approval.',
			variant: 'under_review',
		};
	}
	if (task?.status === 'completed') {
		return {
			label: 'Complete',
			hint: 'Your checklist was approved.',
			variant: 'completed',
		};
	}
	return null;
}

/** Most recent checkout/due dates first; tie-break by due_time descending. */
export function compareTasksByDateDesc(a, b) {
	const checkoutA = a?.checkout_date || a?.due_date || '';
	const checkoutB = b?.checkout_date || b?.due_date || '';
	const byCheckout = checkoutB.localeCompare(checkoutA);
	if (byCheckout !== 0) return byCheckout;
	const byDue = (b?.due_date || '').localeCompare(a?.due_date || '');
	if (byDue !== 0) return byDue;
	return (b?.due_time || '').localeCompare(a?.due_time || '');
}

/** Soonest checkout/due dates first; tie-break by due_time ascending. */
export function compareTasksByDateAsc(a, b) {
	const checkoutA = a?.checkout_date || a?.due_date || '';
	const checkoutB = b?.checkout_date || b?.due_date || '';
	const byCheckout = checkoutA.localeCompare(checkoutB);
	if (byCheckout !== 0) return byCheckout;
	const byDue = (a?.due_date || '').localeCompare(b?.due_date || '');
	if (byDue !== 0) return byDue;
	return (a?.due_time || '').localeCompare(b?.due_time || '');
}

export function sortTasksByDateAsc(tasks) {
	return [...(tasks || [])].sort(compareTasksByDateAsc);
}

export function sortTasksByDateDesc(tasks) {
	return [...(tasks || [])].sort(compareTasksByDateDesc);
}
