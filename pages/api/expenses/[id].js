import { withAuth } from '../../../lib/auth';
import { getExpenseById, updateExpense, deleteExpense, getOwnerStatementApprovalsForProperties } from '../../../lib/db';
import { getProperties, buildPropertyMap } from '../../../lib/hospitable';
import { buildPropertyCodeToNameMap, formatPropertyNameForRow } from '../../../lib/codes';
import {
	attachOwnerStatementInclusion,
	mapApprovedManualExpenseInclusions,
} from '../../../lib/ownerStatementReport';

async function enrichExpenses(rows) {
	if (!rows?.length) return rows || [];
	const properties = await getProperties();
	const propMap = buildPropertyMap(properties);
	const codeToNameMap = buildPropertyCodeToNameMap(properties);
	const formatted = rows.map((row) => formatPropertyNameForRow(row, codeToNameMap, propMap));
	const propertyIds = [...new Set(formatted.map((row) => row.property_id).filter(Boolean))];
	const approvals = await getOwnerStatementApprovalsForProperties(propertyIds);
	const manualExpenseInclusions = mapApprovedManualExpenseInclusions(approvals);
	return formatted.map((row) => attachOwnerStatementInclusion(row, manualExpenseInclusions));
}

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    const { id } = req.query;
    if (req.method === 'GET') {
      const e = await getExpenseById(id);
      if (!e) return res.status(404).json({ error: 'Not found' });
      const [enriched] = await enrichExpenses([e]);
      return res.json({ data: enriched });
    }
    if (req.method === 'PATCH') {
      if (!(await getExpenseById(id))) return res.status(404).json({ error: 'Not found' });
      const updated = await updateExpense(id, req.body);
      const [enriched] = await enrichExpenses([updated]);
      return res.json({ data: enriched });
    }
    if (req.method === 'DELETE') {
      await deleteExpense(id);
      return res.status(204).end();
    }
    res.status(405).end();
  }, { adminOnly: true });
}
