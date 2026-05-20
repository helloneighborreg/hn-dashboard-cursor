import { withAuth } from '../../../lib/auth';
import { getExpenses, createExpense } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method === 'GET') {
      const { property_id, date_from, date_to, category } = req.query;
      const filters = {};
      if (property_id) filters.property_id = property_id;
      if (date_from)   filters.date_from = date_from;
      if (date_to)     filters.date_to = date_to;
      if (category)    filters.category = category;
      return res.json({ data: await getExpenses(filters) });
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
      return res.status(201).json({ data: expense });
    }
    res.status(405).end();
  });
}
