import { withAuth } from '../../../lib/auth';
import {
	completeBillpayInvoice,
	getBillpayInvoiceById,
	reopenBillpayInvoice,
} from '../../../lib/billpayDb';

export default async function handler(req, res) {
	await withAuth(req, res, async (session) => {
		const { id } = req.query;
		if (!id) return res.status(400).json({ error: 'Invoice id required' });

		if (req.method === 'PATCH') {
			const invoice = await getBillpayInvoiceById(id);
			if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

			const completedBy = session.user?.name || session.user?.username || null;
			if (req.body?.status === 'pending') {
				const updated = await reopenBillpayInvoice(id);
				if (!updated) return res.status(409).json({ error: 'Invoice is not completed' });
				return res.json({ data: updated });
			}

			const updated = await completeBillpayInvoice(id, completedBy);
			if (!updated) return res.status(409).json({ error: 'Invoice is already completed' });
			return res.json({ data: updated });
		}

		res.status(405).end();
	}, { adminOnly: true });
}
