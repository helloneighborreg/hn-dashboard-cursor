import { formatDateTime } from './dates';

/** Apply timestamp fields when assignee or status changes. */
export function applyTaskHistoryPatches(previousTask, updates) {
	const patch = { ...updates };
	const prevStatus = previousTask?.status;
	const nextStatus = updates.status ?? prevStatus;
	const ts = new Date().toISOString();

	if (updates.assignee !== undefined) {
		const prev = previousTask?.assignee?.trim() || '';
		const next = updates.assignee?.trim() || '';
		if (next && next !== prev) {
			patch.assigned_at = ts;
		} else if (!next) {
			patch.assigned_at = null;
		}
	}

	if (updates.status !== undefined) {
		if (nextStatus === 'completed' && prevStatus !== 'completed') {
			patch.completed_at = ts;
			if (!previousTask?.started_at && updates.started_at === undefined) {
				patch.started_at = ts;
			}
			const hasSubmission = updates.fillout_submission_id
				|| updates.checklist_submission_url
				|| previousTask?.fillout_submission_id
				|| previousTask?.checklist_submission_url;
			if (hasSubmission && !previousTask?.submitted_at) {
				patch.submitted_at = ts;
			}
		} else if (nextStatus !== 'completed' && prevStatus === 'completed') {
			patch.completed_at = null;
			patch.approved_at = null;
			patch.paid_at = null;
			patch.paid_by = null;
		}
	}

	if (updates.paid_at !== undefined) {
		if (!updates.paid_at) {
			patch.paid_by = null;
		}
	}

	return patch;
}

export function taskScheduledByLabel(task) {
	if (task?.scheduled_by?.trim()) return task.scheduled_by.trim();
	if (task?.type === 'turnover') return 'Auto-scheduled';
	return null;
}

const TIMELINE_EVENTS = [
	{ key: 'created_at', label: 'Scheduled', detail: taskScheduledByLabel },
	{ key: 'assigned_at', label: 'Assigned', detail: (task) => task.assignee?.trim() || null },
	{ key: 'started_at', label: 'Started' },
	{ key: 'submitted_at', label: 'Checklist submitted' },
	{ key: 'completed_at', label: 'Completed' },
	{ key: 'paid_at', label: 'Paid', detail: (task) => task.paid_by?.trim() || null },
];

/** Ordered timeline entries for a task (only events with timestamps). */
export function buildTaskHistoryEntries(task) {
	if (!task) return [];
	return TIMELINE_EVENTS.map(({ key, label, detail }) => ({
		key,
		label,
		at: task[key] || null,
		detail: detail?.(task) || null,
	})).filter((entry) => entry.at);
}

export function formatTaskHistoryTimestamp(value) {
	return formatDateTime(value);
}
