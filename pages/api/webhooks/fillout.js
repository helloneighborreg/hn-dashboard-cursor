/**
 * Fillout form submission webhook — marks the matching dashboard task completed.
 *
 * Setup (Fillout → Integrate → Webhook):
 *   POST https://your-domain.com/api/webhooks/fillout
 *   Header: x-fillout-secret: <FILLOUT_WEBHOOK_SECRET>
 */
import { applyFilloutSubmissionToTask } from '../../../lib/filloutTaskUpdate';
import { mergeWebhookRequestPayload } from '../../../lib/filloutWebhook';
import { safeEqual } from '../../../lib/secureCompare';

function verifySecret(req, res) {
	const secret = (process.env.FILLOUT_WEBHOOK_SECRET || '').trim();
	// Require the secret in every environment except local development. An unauthenticated
	// webhook can mark tasks completed, so it must never be open on a deployed instance.
	if (!secret) {
		if (process.env.NODE_ENV === 'development') return true;
		res.status(503).json({ error: 'FILLOUT_WEBHOOK_SECRET is not configured' });
		return false;
	}
	const header = req.headers['x-fillout-secret'] || req.headers['x-webhook-secret'];
	if (!header || !safeEqual(header, secret)) {
		res.status(401).json({ error: 'Invalid webhook secret' });
		return false;
	}
	return true;
}

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).end();
	if (!verifySecret(req, res)) return;

	try {
		const payload = mergeWebhookRequestPayload(req.body, req.query);
		const result = await applyFilloutSubmissionToTask(payload);

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

		if (result.verified) {
			return res.json({
				ok: true,
				task_id: result.task.id,
				status: result.task.status,
				verified: true,
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
