import { withAuth } from '../../../lib/auth';
import { getTaskById, updateTask, deleteTask } from '../../../lib/db';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    const { id } = req.query;

    if (req.method === 'GET') {
      const task = await getTaskById(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      return res.json({ data: task });
    }
    if (req.method === 'PATCH') {
      const task = await getTaskById(id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      return res.json({ data: await updateTask(id, req.body) });
    }
    if (req.method === 'DELETE') {
      await deleteTask(id);
      return res.status(204).end();
    }
    res.status(405).end();
  });
}
