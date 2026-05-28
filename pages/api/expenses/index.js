import { withAuth } from '../../../lib/auth';
import { getExpenses, createExpense } from '../../../lib/db';
import { getProperties, buildPropertyMap } from '../../../lib/hospitable';
import { buildPropertyCodeToNameMap, formatPropertyNameForRow } from '../../../lib/codes';
import { v4 as uuidv4 } from 'uuid';

async function enrichExpenses(rows) {
	if (!rows?.length) return rows || [];
	const properties = await getProperties();
	const propMap = buildPropertyMap(properties);
	const codeToNameMap = buildPropertyCodeToNameMap(properties);
	return rows.map((row) => formatPropertyNameForRow(row, codeToNameMap, propMap));
}

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method === 'GET') {
      const { property_id, date_from, date_to, category } = req.query;
      const filters = {};
      if (property_id) filters.property_id = property_id;
      if (date_from)   filters.date_from = date_from;
      if (date_to)     filters.date_to = date_to;
      if (category)    filters.category = category;
      return res.json({ data: await enrichExpenses(await getExpenses(filters)) });
    }
    if (req.method === 'POST') {
      const { date, property_id, property_name, category, vendor, amount, notes, receipt_url } = req.body;
      if (!date || !property_id || !category || amount == null)
        return res.status(400).json({ error: 'date, property_id, category, and amount are required' });
      const expense = await createExpense({
        id: uuidv4(), date, property_id, property_name: property_name || '',
        category, vendor: vendor || null, amount: parseFloat(amount),
        notes: notes || null, receipt_url: receipt_url || null,
      });
      const [enriched] = await enrichExpenses([expense]);
      return res.status(201).json({ data: enriched });
    }
    res.status(405).end();
  }, { adminOnly: true });
}
