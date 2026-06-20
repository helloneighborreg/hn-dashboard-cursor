import { v4 as uuidv4 } from 'uuid';
import { withAuth } from '../../../../lib/auth';
import { getTaskById } from '../../../../lib/db';
import { applyFilloutSubmissionToTask } from '../../../../lib/filloutTaskUpdate';
import { withChecklistUrl } from '../../../../lib/checklistUrl';
import { enrichTasks } from '../../../../lib/taskEnrich';

function buildTestWebhookPayload(task) {
	return {
		submission: {
			submissionId: task.fillout_submission_id || uuidv4(),
			urlParameters: [
				{ name: 'TaskID', value: task.id },
				{ name: 'ReservationID', value: task.reservation_id },
				{ name: 'id', value: task.id },
			],
		},
	};
}

function resultMessage(result) {
	if (!result.ok) return result.error || 'Task not found';
	if (result.already_completed && !result.updated) {
		return 'Webhook test OK — task was already completed (no changes).';
	}
	const parts = ['Webhook test OK'];
	if (result.updated) parts.push('task updated');
	if (result.task?.checklist_pdf_url) parts.push('PDF linked');
	if (result.task?.checklist_submission_url) parts.push('checklist link saved');
	if (result.task?.status === 'completed') parts.push('marked completed');
	return `${parts.join(' · ')}.`;
}

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	await withAuth(req, res, async () => {
		const { id } = req.query;
		const task = await getTaskById(id);
		if (!task) return res.status(404).json({ error: 'Task not found' });

		try {
			const result = await applyFilloutSubmissionToTask(buildTestWebhookPayload(task), { skipNotify: true });
			if (!result.ok) {
				return res.status(404).json({
					ok: false,
					error: result.error,
					taskId: result.taskId,
					reservationId: result.reservationId,
				});
			}

			const [enrichedRow] = result.task ? await enrichTasks([result.task]) : [null];
			const enriched = enrichedRow ? withChecklistUrl(enrichedRow) : null;

			return res.json({
				ok: true,
				message: resultMessage({ ...result, task: enriched }),
				updated: Boolean(result.updated),
				already_completed: Boolean(result.already_completed),
				data: enriched,
			});
		} catch (err) {
			console.error('Fillout webhook test failed:', err.message);
			return res.status(500).json({ ok: false, error: err.message });
		}
	}, { adminOnly: true });
}
