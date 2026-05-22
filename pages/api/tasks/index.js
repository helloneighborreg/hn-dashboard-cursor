import { withAuth, isAdmin, isCleaner } from '../../../lib/auth';
import { getTasks, createTask, getTasksForToday } from '../../../lib/db';
import { getPropertyCode } from '../../../lib/hospitable';
import { getChecklistUrl } from '../../../lib/propertyChecklists';
import { withChecklistUrl } from '../../../lib/checklistUrl';
import { notifyTaskAssigned } from '../../../lib/notify';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  try {
    await withAuth(req, res, async (session) => {
      if (req.method === 'GET') {
        const { property_id, status, assignee, due_date, date_from, date_to, today, type, unassigned, assigned } = req.query;
        const filters = {};
        if (isCleaner(session.user)) {
          filters.assigned = true;
          filters.assignee = session.user.name;
        } else {
          if (unassigned === 'true') filters.unassigned = true;
          if (assigned === 'true') filters.assigned = true;
          if (assignee) filters.assignee = assignee;
        }
        if (property_id) filters.property_id = property_id;
        if (status)      filters.status = status;
        if (type)        filters.type = type;
        if (due_date)    filters.due_date = due_date;
        if (date_from)   filters.date_from = date_from;
        if (date_to)     filters.date_to = date_to;

        const rows = today === 'true' ? await getTasksForToday() : await getTasks(filters);
        const data = isCleaner(session.user)
          ? rows.filter((t) => t.assignee === session.user.name).map(withChecklistUrl)
          : rows.map(withChecklistUrl);
        return res.json({ data });
      }

      if (req.method === 'POST') {
        if (!isAdmin(session.user)) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        const { reservation_id, property_id, property_name, title, description,
                due_date, due_time, checkout_date, assignee, type, notes, status } = req.body;

        if (!property_id || !due_date || !title?.trim())
          return res.status(400).json({ error: 'property_id, due_date, and title are required' });

        const propCode = property_name || '';
        const task = await createTask({
          id: uuidv4(),
          reservation_id: reservation_id || `manual-${uuidv4()}`,
          property_id,
          property_name: propCode,
          guest_name: req.body.guest_name || '',
          checklist_url: req.body.checklist_url || getChecklistUrl(propCode),
          title: title.trim(),
          description: description || '',
          due_date,
          due_time: due_time || '16:00',
          start_time: req.body.start_time || '10:00',
          checkout_date: checkout_date || due_date,
          status: status || (assignee ? 'assigned' : 'unassigned'),
          assignee: assignee || null,
          type: type || 'other',
          notes: notes || null,
        });

        const enriched = withChecklistUrl(task);
        if (assignee) {
          try {
            await notifyTaskAssigned(enriched, assignee);
          } catch (err) {
            console.error('Task assignment notify failed:', err.message);
          }
        }

        return res.status(201).json({ data: enriched });
      }

      res.status(405).end();
    });
  } catch (err) {
    console.error('GET /api/tasks failed:', err);
    res.status(500).json({ error: err.message || 'Failed to load tasks' });
  }
}
