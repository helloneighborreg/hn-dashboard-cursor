import { withAuth } from '../../../lib/auth';
import { getTasks, createTask, getTasksForToday } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  await withAuth(req, res, async () => {
    if (req.method === 'GET') {
      const { property_id, status, assignee, due_date, date_from, date_to, today, type } = req.query;
      const filters = {};
      if (property_id) filters.property_id = property_id;
      if (status)      filters.status = status;
      if (assignee)    filters.assignee = assignee;
      if (type)        filters.type = type;
      if (due_date)    filters.due_date = due_date;
      if (date_from)   filters.date_from = date_from;
      if (date_to)     filters.date_to = date_to;

      const tasks = today === 'true' ? getTasksForToday() : getTasks(filters);
      return res.json({ data: tasks });
    }

    if (req.method === 'POST') {
      const { reservation_id, property_id, property_name, title, description,
              due_date, due_time, checkout_date, assignee, type, notes, status } = req.body;

      if (!property_id || !due_date || !title?.trim())
        return res.status(400).json({ error: 'property_id, due_date, and title are required' });

      const task = createTask({
        id: uuidv4(),
        reservation_id: reservation_id || `manual-${uuidv4()}`,
        property_id,
        property_name: property_name || '',
        title: title.trim(),
        description: description || '',
        due_date,
        due_time: due_time || '16:00',
        checkout_date: checkout_date || due_date,
        status: status || (assignee ? 'assigned' : 'unassigned'),
        assignee: assignee || null,
        type: type || 'other',
        notes: notes || null,
      });
      return res.status(201).json({ data: task });
    }

    res.status(405).end();
  });
}
