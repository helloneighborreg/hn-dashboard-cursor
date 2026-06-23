import { withAuth } from '../../../lib/auth';
import { buildReport } from '../../../lib/reports';
import { normalizeReportId } from '../../../lib/reportDefinitions';
import { parsePropertyIdsQuery } from '../../../lib/propertyGroups';

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		if (req.method !== 'GET') return res.status(405).end();

		const { report, property, properties, date_from, date_to, interval, category_level } = req.query;
		const reportId = normalizeReportId(report);
		if (!reportId) return res.status(400).json({ error: 'Report is required.' });
		const property_ids = parsePropertyIdsQuery(properties)
			|| (property ? [String(property).trim()] : null);

		try {
			const data = await buildReport(reportId, {
				property_ids: property_ids ?? undefined,
				date_from: date_from || undefined,
				date_to: date_to || undefined,
				interval: interval || 'month',
				category_level: category_level || 'subcategory',
			});
			res.json({ data });
		} catch (err) {
			console.error('Reports error:', err.message);
			res.status(502).json({ error: err.message });
		}
	}, { adminOnly: true });
}
