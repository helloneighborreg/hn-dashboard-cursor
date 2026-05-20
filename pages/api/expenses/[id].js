import { withAuth } from '../../../lib/auth';
import { getExpenseById, updateExpense, deleteExpense } from '../../../lib/db';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    const { id } = req.query;
    if (req.method === 'GET') {
      const e = getExpenseById(id);
      if (!e) return res.status(404).json({ error: 'Not found' });
      return res.json({ data: e });
    }
    if (req.method === 'PATCH') {
      if (!getExpenseById(id)) return res.status(404).json({ error: 'Not found' });
      return res.json({ data: updateExpense(id, req.body) });
    }
    if (req.method === 'DELETE') {
      deleteExpense(id);
      return res.status(204).end();
    }
    res.status(405).end();
  });
}
