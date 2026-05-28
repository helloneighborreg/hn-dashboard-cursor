export const ASSIGNEES = ['Brandi Drieslein', 'Josiah Burton', 'Rachel Jackson', 'Other'];

export const TASK_STATUSES = ['unassigned', 'assigned', 'completed'];

export function formatTaskStatus(status) {
	if (!status) return '—';
	if (status === 'unassigned') return 'Unassigned';
	return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
	return Boolean(task?.due_date && task.due_date < today && task.status !== 'completed');
}

/** UI indicator: overdue → exclamation; else completed / assigned / unassigned dot. */
export function getTaskStatusIndicator(task) {
	if (task?.status === 'completed') {
		return { kind: 'completed', label: 'Completed' };
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
	const counts = { unassigned: 0, assigned: 0, completed: 0, overdue: 0 };
	for (const task of tasks || []) {
		counts[getTaskStatusIndicator(task).kind] += 1;
	}
	return counts;
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

export function sortTasksByDateDesc(tasks) {
	return [...(tasks || [])].sort(compareTasksByDateDesc);
}
