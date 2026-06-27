import { withAuth } from '../../../lib/auth';
import { getExpenseById, updateExpense, deleteExpense, getOwnerStatementApprovalsForProperties } from '../../../lib/db';
import { getProperties, buildPropertyMap } from '../../../lib/hospitable';
import { buildPropertyCodeToNameMap, formatPropertyNameForRow } from '../../../lib/codes';
import {
	attachOwnerStatementInclusion,
	mapApprovedManualExpenseInclusions,
} from '../../../lib/ownerStatementReport';
import { OWNER_STATEMENT_ITEM_LOCKED_ERROR, isOwnerStatementCashItemLocked } from '../../../lib/ownerStatementLock';
import { isHiddenPropertyId } from '../../../lib/hiddenProperties';

async function assertExpenseEditable(expense) {
	if (!expense?.property_id || !expense?.id) return;
	const locked = await isOwnerStatementCashItemLocked(expense.property_id, expense.id, 'manual');
	if (locked) {
		const err = new Error(OWNER_STATEMENT_ITEM_LOCKED_ERROR);
		err.status = 403;
		throw err;
	}
}

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
      if (!e || isHiddenPropertyId(e.property_id)) return res.status(404).json({ error: 'Not found' });
      const [enriched] = await enrichExpenses([e]);
      return res.json({ data: enriched });
    }
    if (req.method === 'PATCH') {
      const existing = await getExpenseById(id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      try {
        await assertExpenseEditable(existing);
      } catch (err) {
        return res.status(err.status || 403).json({ error: err.message });
      }
      const updated = await updateExpense(id, req.body);
      const [enriched] = await enrichExpenses([updated]);
      return res.json({ data: enriched });
    }
    if (req.method === 'DELETE') {
      const existing = await getExpenseById(id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      try {
        await assertExpenseEditable(existing);
      } catch (err) {
        return res.status(err.status || 403).json({ error: err.message });
      }
      await deleteExpense(id);
      return res.status(204).end();
    }
    res.status(405).end();
  }, { adminOnly: true });
}
