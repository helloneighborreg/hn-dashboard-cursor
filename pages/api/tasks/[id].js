import { withAuth, isAdmin, isCleaner } from '../../../lib/auth';
import { getTaskById, updateTask, deleteTask } from '../../../lib/db';
import { notifyTaskAssigned, notifyTaskBookingChanged, notifyIfTaskCompleted } from '../../../lib/notify';
import { withChecklistUrl } from '../../../lib/checklistUrl';
import { enrichTasks } from '../../../lib/taskEnrich';
import { sanitizeTaskForViewer } from '../../../lib/taskSanitize';
import { taskBookingChanged } from '../../../lib/taskSchedule';

function taskBelongsToCleaner(task, user) {
	return task?.assignee === user?.name;
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session, navPermissions) => {
		const { id } = req.query;

		if (req.method === 'GET') {
			const task = await getTaskById(id);
			if (!task) return res.status(404).json({ error: 'Task not found' });
			if (isCleaner(session.user) && !taskBelongsToCleaner(task, session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}
			const enriched = await enrichTasks([task]);
			return res.json({ data: sanitizeTaskForViewer(withChecklistUrl(enriched[0]), session.user, navPermissions) });
		}
		if (req.method === 'PATCH') {
			if (!isAdmin(session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}

			const task = await getTaskById(id);
			if (!task) return res.status(404).json({ error: 'Task not found' });

			const body = { ...req.body };
			if (body.paid === true) {
				body.paid_at = new Date().toISOString();
				body.paid_by = session.user?.name || session.user?.username || null;
				delete body.paid;
			} else if (body.paid === false) {
				body.paid_at = null;
				body.paid_by = null;
				delete body.paid;
			}

			const prevAssignee = task.assignee;
			const updated = await updateTask(id, body, { previousTask: task });
			const [enrichedRow] = await enrichTasks([updated]);
			const enriched = withChecklistUrl(enrichedRow);
			const newAssignee =
				req.body.assignee !== undefined ? req.body.assignee || null : enriched?.assignee;

			let notified = null;
			if (newAssignee && newAssignee !== prevAssignee) {
				try {
					notified = await notifyTaskAssigned(enriched, newAssignee);
				} catch (err) {
					console.error('Task assignment notify failed:', err.message);
					notified = { skipped: true, reason: 'error' };
				}
			} else if (taskBookingChanged(task, updated)) {
				try {
					notified = await notifyTaskBookingChanged(enriched, task, enriched?.assignee);
				} catch (err) {
					console.error('Task schedule notify failed:', err.message);
					notified = { skipped: true, reason: 'error' };
				}
			}

			let completionNotified = null;
			try {
				completionNotified = await notifyIfTaskCompleted(task, updated);
			} catch (err) {
				console.error('Task completion notify failed:', err.message);
				completionNotified = { skipped: true, reason: 'error' };
			}

			return res.json({ data: enriched, notified, completionNotified });
		}
		if (req.method === 'DELETE') {
			if (!isAdmin(session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}
			await deleteTask(id);
			return res.status(204).end();
		}
		res.status(405).end();
	});
}
