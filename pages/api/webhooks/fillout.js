/**
 * Fillout form submission webhook.
 * Configure in Fillout → Integrations → Webhook → POST to:
 *   https://your-domain.com/api/webhooks/fillout
 *
 * Include hidden fields or URL params echoed in the webhook body:
 *   task_id (preferred) or reservation_id
 * Optional: submissionId, pdfUrl / pdf_url (PDF export link from Fillout)
 */
import { getTaskById, getTaskByReservationId, updateTask } from '../../../lib/db';

function pick(body, ...keys) {
	for (const key of keys) {
		const v = body?.[key];
		if (v != null && String(v).trim() !== '') return String(v).trim();
	}
	return null;
}

function extractPayload(body) {
	const data = body?.data || body?.submission || body;
	return {
		taskId: pick(body, 'task_id', 'taskId') || pick(data, 'task_id', 'taskId'),
		reservationId:
			pick(body, 'reservation_id', 'reservationId') ||
			pick(data, 'reservation_id', 'reservationId'),
		submissionId:
			pick(body, 'submissionId', 'submission_id', 'id') ||
			pick(data, 'submissionId', 'submission_id', 'id'),
		pdfUrl:
			pick(body, 'pdfUrl', 'pdf_url', 'pdf') ||
			pick(data, 'pdfUrl', 'pdf_url', 'pdf'),
	};
}

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();

	const secret = (process.env.FILLOUT_WEBHOOK_SECRET || '').trim();
	if (process.env.NODE_ENV === 'production' && !secret) {
		return res.status(503).json({ error: 'FILLOUT_WEBHOOK_SECRET is not configured' });
	}
	if (secret) {
		const header = req.headers['x-fillout-secret'] || req.headers['x-webhook-secret'];
		if (header !== secret) {
			return res.status(401).json({ error: 'Invalid webhook secret' });
		}
	}

	try {
		const { taskId, reservationId, submissionId, pdfUrl } = extractPayload(req.body);

		let task = null;
		if (taskId) task = await getTaskById(taskId);
		if (!task && reservationId) task = await getTaskByReservationId(reservationId);

		if (!task) {
			return res.status(404).json({
				error: 'Task not found',
				hint: 'Pass task_id or reservation_id in the Fillout webhook payload (hidden field or URL param).',
			});
		}

		const notes = [
			task.notes,
			submissionId ? `Fillout submission: ${submissionId}` : null,
			pdfUrl ? `Checklist PDF: ${pdfUrl}` : null,
		]
			.filter(Boolean)
			.join('\n');

		const updated = await updateTask(task.id, {
			status: 'completed',
			fillout_submission_id: submissionId || task.fillout_submission_id,
			checklist_pdf_url: pdfUrl || task.checklist_pdf_url,
			notes: notes || task.notes,
		});

		return res.json({ ok: true, task_id: updated.id, status: updated.status });
	} catch (err) {
		console.error('Fillout webhook error:', err.message);
		return res.status(500).json({ error: err.message });
	}
}
