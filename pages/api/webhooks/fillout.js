/**
 * Fillout form submission webhook — marks the matching dashboard task completed.
 *
 * Setup (Fillout → Integrate → Webhook):
 *   POST https://your-domain.com/api/webhooks/fillout
 *   Header: x-fillout-secret: <FILLOUT_WEBHOOK_SECRET>
 */
import { applyFilloutSubmissionToTask } from '../../../lib/filloutTaskUpdate';

function verifySecret(req, res) {
	const secret = (process.env.FILLOUT_WEBHOOK_SECRET || '').trim();
	if (process.env.NODE_ENV === 'production' && !secret) {
		res.status(503).json({ error: 'FILLOUT_WEBHOOK_SECRET is not configured' });
		return false;
	}
	if (secret) {
		const header = req.headers['x-fillout-secret'] || req.headers['x-webhook-secret'];
		if (header !== secret) {
			res.status(401).json({ error: 'Invalid webhook secret' });
			return false;
		}
	}
	return true;
}

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();
	if (!verifySecret(req, res)) return;

	try {
		const result = await applyFilloutSubmissionToTask(req.body);

		if (!result.ok) {
			console.warn('Fillout webhook: task not found', {
				taskId: result.taskId,
				reservationId: result.reservationId,
			});
			return res.status(404).json({
				error: result.error,
				hint: 'Ensure the Fillout form receives task_id (or reservation_id) from the checklist URL parameters.',
				received: { taskId: result.taskId, reservationId: result.reservationId },
			});
		}

		if (result.already_completed) {
			return res.json({
				ok: true,
				task_id: result.task.id,
				status: result.task.status,
				already_completed: true,
			});
		}

		if (result.updated) {
			console.info('Fillout webhook: task updated', { task_id: result.task.id });
		}

		return res.json({
			ok: true,
			task_id: result.task.id,
			status: result.task.status,
		});
	} catch (err) {
		console.error('Fillout webhook error:', err.message);
		return res.status(500).json({ error: err.message });
	}
}
