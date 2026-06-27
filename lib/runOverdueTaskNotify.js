import { getTasksPendingOverdueNotify, markTaskOverdueNotified } from './db';
import { notifyTaskOverdue } from './notify';
import { withChecklistUrl } from './checklistUrl';
import { enrichTasks } from './taskEnrich';

/**
 * Find assigned tasks past due date/time and notify assignee + admins once each.
 * Called from the overdue-notify cron (every 15 minutes).
 */
export async function runOverdueTaskNotify() {
	const candidates = await getTasksPendingOverdueNotify();
	if (!candidates.length) {
		return { checked: 0, notified: 0, results: [] };
	}

	const enriched = await enrichTasks(candidates);
	const results = [];

	for (const row of enriched) {
		const task = withChecklistUrl(row);
		try {
			const outcome = await notifyTaskOverdue(task, task.assignee);
			if (outcome.delivered) {
				await markTaskOverdueNotified(task.id);
			}
			results.push({
				id: task.id,
				title: task.title,
				assignee: task.assignee,
				delivered: Boolean(outcome.delivered),
				outcome,
			});
		} catch (err) {
			console.error(`Overdue notify failed for task ${task.id}:`, err.message);
			results.push({
				id: task.id,
				title: task.title,
				assignee: task.assignee,
				delivered: false,
				error: err.message,
			});
		}
	}

	return {
		checked: candidates.length,
		notified: results.filter((r) => r.delivered).length,
		results,
	};
}
