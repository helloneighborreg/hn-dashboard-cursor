import { withAuth } from '../../../lib/auth';
import {
	getBillpayInvoices,
	syncMissingBillpayInvoices,
} from '../../../lib/billpayDb';
import { billpayInvoiceTotal } from '../../../lib/billpay';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method === 'GET') {
			try {
				await syncMissingBillpayInvoices();
			} catch (err) {
				console.error('Billpay sync failed:', err.message);
			}
			const status = req.query.status === 'completed' ? 'completed' : 'pending';
			const invoices = await getBillpayInvoices({ status });
			return res.json({
				data: invoices,
				summary: {
					count: invoices.length,
					total: billpayInvoiceTotal(invoices),
				},
			});
		}
		res.status(405).end();
	}, { adminOnly: true });
}
