import { withAuth } from '../../../../lib/auth';
import { getPropertyOwner, upsertPropertyOwner } from '../../../../lib/db';
import { toIsoDate } from '../../../../lib/dates';
import { DEFAULT_MANAGEMENT_FEE_PERCENT } from '../../../../lib/ownerStatementReport';

function parseManagementFeePercent(value) {
	if (value === '' || value == null) return DEFAULT_MANAGEMENT_FEE_PERCENT;
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0 || n > 100) {
		throw new Error('Management fee % must be a number between 0 and 100.');
	}
	return Math.round(n * 100) / 100;
}

function normalizeOwnerBody(body = {}) {
	return {
		name: String(body.name ?? '').trim(),
		address: String(body.address ?? '').trim(),
		email: String(body.email ?? '').trim(),
		phone: String(body.phone ?? '').trim(),
		agreement_expiration: body.agreement_expiration
			? toIsoDate(body.agreement_expiration) || null
			: null,
		management_fee_percent: parseManagementFeePercent(body.management_fee_percent),
		notes: String(body.notes ?? '').trim(),
	};
}

export default async function handler(req, res) {
	await withAuth(req, res, async () => {
		const { id: propertyId } = req.query;
		if (!propertyId) return res.status(400).json({ error: 'Property id is required.' });

		if (req.method === 'GET') {
			const owner = await getPropertyOwner(propertyId);
			return res.json({ data: owner || { property_id: propertyId } });
		}

		if (req.method === 'PUT' || req.method === 'PATCH') {
			const owner = await upsertPropertyOwner(propertyId, normalizeOwnerBody(req.body));
			return res.json({ data: owner });
		}

		return res.status(405).end();
	}, { adminOnly: true });
}
