import { withAuth } from '../../../../lib/auth';
import { getBankTransactions } from '../../../../lib/db';
import { isUncategorized } from '../../../../lib/bookkeepingCategories';

function summarizeTransactions(rows) {
	const visible = rows.filter((tx) => !tx.hidden);
	const uncategorized = visible.filter((tx) => isUncategorized(tx.category));
	const needsReview = visible.filter((tx) => !tx.reviewed);
	const uncategorizedTotal = uncategorized.reduce(
		(sum, tx) => sum + Math.abs(Number(tx.amount) || 0),
		0,
	);

	const categorized = visible.filter((tx) => !isUncategorized(tx.category) && tx.reviewed);
	const pct = visible.length
		? Math.round((categorized.length / visible.length) * 100)
		: 100;

	return {
		total: visible.length,
		uncategorized_count: uncategorized.length,
		uncategorized_total: uncategorizedTotal,
		needs_review_count: needsReview.length,
		categorized_pct: pct,
	};
}

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'GET') return res.status(405).end();

		const {
			date_from,
			date_to,
			account_id,
			property_id,
			category,
			uncategorized,
			reviewed,
			hidden,
		} = req.query;

		try {
			const data = await getBankTransactions({
				date_from,
				date_to,
				account_id,
				property_id,
				category,
				uncategorized: uncategorized === 'true' ? true : undefined,
				reviewed,
				hidden: hidden === 'true' ? 'true' : hidden === 'false' ? 'false' : undefined,
			});
			res.json({ data, summary: summarizeTransactions(data) });
		} catch (err) {
			console.error('Bank transactions error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
