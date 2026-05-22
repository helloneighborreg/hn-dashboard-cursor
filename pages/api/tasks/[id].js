import { withAuth, isAdmin, isCleaner } from '../../../lib/auth';
import { getTaskById, updateTask, deleteTask } from '../../../lib/db';
import { notifyTaskAssigned } from '../../../lib/notify';
import { withChecklistUrl } from '../../../lib/checklistUrl';

function taskBelongsToCleaner(task, user) {
	return task?.assignee === user?.name;
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		const { id } = req.query;

		if (req.method === 'GET') {
			const task = await getTaskById(id);
			if (!task) return res.status(404).json({ error: 'Task not found' });
			if (isCleaner(session.user) && !taskBelongsToCleaner(task, session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}
			return res.json({ data: withChecklistUrl(task) });
		}
		if (req.method === 'PATCH') {
			if (!isAdmin(session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}

			const task = await getTaskById(id);
			if (!task) return res.status(404).json({ error: 'Task not found' });

			const prevAssignee = task.assignee;
			const updated = await updateTask(id, req.body);
			const enriched = withChecklistUrl(updated);
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
			}

			return res.json({ data: enriched, notified });
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
