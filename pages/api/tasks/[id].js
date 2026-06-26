import { withAuth, isAdmin, isCleaner } from '../../../lib/auth';
import { deleteBillpayInvoiceForTask, upsertBillpayInvoiceForTask } from '../../../lib/billpayDb';
import { getTaskById, updateTask, deleteTask } from '../../../lib/db';
import { notifyTaskAssigned, notifyTaskBookingChanged, notifyIfTaskCompleted } from '../../../lib/notify';
import { withChecklistUrl, submissionIdFromChecklistUrl } from '../../../lib/checklistUrl';
import { enrichTasks } from '../../../lib/taskEnrich';
import { sanitizeTaskForViewer } from '../../../lib/taskSanitize';
import { taskBookingChanged } from '../../../lib/taskSchedule';
import { isHiddenPropertyId } from '../../../lib/hiddenProperties';
import { approveChecklistPhotoReview } from '../../../lib/forms/checklistPhotoReview';

function taskBelongsToCleaner(task, user) {
	return task?.assignee === user?.name;
}

export default async function handler(req, res) {
	await withAuth(req, res, async (session, navPermissions) => {
		const { id } = req.query;

		if (req.method === 'GET') {
			const task = await getTaskById(id);
			if (!task || isHiddenPropertyId(task.property_id)) return res.status(404).json({ error: 'Task not found' });
			if (isCleaner(session.user) && !taskBelongsToCleaner(task, session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}
			const enriched = await enrichTasks([task]);
			let payload = sanitizeTaskForViewer(withChecklistUrl(enriched[0]), session.user, navPermissions);
			return res.json({ data: payload });
		}
		if (req.method === 'PATCH') {
			if (!isAdmin(session.user)) {
				return res.status(403).json({ error: 'Forbidden' });
			}

			const task = await getTaskById(id);
			if (!task || isHiddenPropertyId(task.property_id)) return res.status(404).json({ error: 'Task not found' });

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
			const wasPaid = Boolean(task.paid_at);
			const willBePaid = body.paid_at !== undefined ? Boolean(body.paid_at) : wasPaid;

			if (body.checklist_review_status === 'approved') {
				const submissionId = submissionIdFromChecklistUrl(task.checklist_submission_url);
				if (submissionId) {
					try {
						await approveChecklistPhotoReview(submissionId);
					} catch (err) {
						console.error('Checklist review approve failed:', err.message);
					}
				}
			}

			const updated = await updateTask(id, body, { previousTask: task });

			if (willBePaid && !wasPaid) {
				try {
					await upsertBillpayInvoiceForTask(updated);
				} catch (err) {
					console.error('Billpay invoice create failed:', err.message);
				}
			} else if (wasPaid && !willBePaid) {
				try {
					await deleteBillpayInvoiceForTask(id);
				} catch (err) {
					console.error('Billpay invoice delete failed:', err.message);
				}
			} else if (willBePaid && wasPaid) {
				try {
					await upsertBillpayInvoiceForTask(updated);
				} catch (err) {
					console.error('Billpay invoice refresh failed:', err.message);
				}
			}

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
