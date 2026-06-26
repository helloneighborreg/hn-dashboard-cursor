import { withAuth, isAdmin } from '../../../lib/auth';
import { hasLimitedTasksView } from '../../../lib/roles';
import { getTasks, createTask, getTasksForToday } from '../../../lib/db';
import { countTasksByIndicator, sortTasksByDateAsc, sortTasksByDateDesc } from '../../../lib/constants';
import { getChecklistUrl } from '../../../lib/propertyChecklists';
import { withChecklistUrl } from '../../../lib/checklistUrl';
import { enrichTasks } from '../../../lib/taskEnrich';
import { sanitizeTasksForViewer, sanitizeTaskForViewer } from '../../../lib/taskSanitize';
import { notifyTaskAssigned } from '../../../lib/notify';
import { filterHiddenPropertyRows, isHiddenPropertyId } from '../../../lib/hiddenProperties';
import { v4 as uuidv4 } from 'uuid';

function buildScopeFilters(query, session) {
	const { property_id, assignee, due_date, date_from, date_to, type, status } = query;
	const filters = {};

	if (hasLimitedTasksView(session.user)) {
		filters.assignee = session.user.name;
	} else if (assignee) {
		filters.assignee = assignee;
	}

	if (property_id) filters.property_id = property_id;
	if (!hasLimitedTasksView(session.user) && status) filters.status = status;
	if (type) filters.type = type;
	if (due_date) filters.due_date = due_date;
	if (date_from) filters.date_from = date_from;
	if (date_to) filters.date_to = date_to;

	return filters;
}

function applyTabFilter(filters, query, session) {
	const { unassigned, assigned, completed, overdue, calendar } = query;
	const isCalendar = calendar === 'true';

	if (hasLimitedTasksView(session.user)) {
		if (completed === 'true') {
			return { ...filters, status: 'completed' };
		}
		if (overdue === 'true') {
			return { ...filters, assigned: true, exclude_completed: true, overdue: true, sort_soonest: true };
		}
		return { ...filters, assigned: true, exclude_completed: true, exclude_overdue: true, sort_soonest: true };
	}

	const { status: scopeStatus, ...rest } = filters;

	if (completed === 'true') {
		return { ...rest, status: 'completed' };
	}
	if (overdue === 'true') {
		const base = { ...rest, assigned: true, exclude_completed: true, overdue: true, sort_soonest: true };
		return scopeStatus ? { ...base, status: scopeStatus } : base;
	}
	if (unassigned === 'true') {
		const base = { ...rest, unassigned: true, exclude_completed: true, sort_soonest: true };
		return scopeStatus ? { ...base, status: scopeStatus } : base;
	}
	if (assigned === 'true') {
		const base = { ...rest, assigned: true, sort_soonest: true };
		if (scopeStatus) return { ...base, status: scopeStatus };
		if (isCalendar) return { ...base, exclude_completed: true };
		return { ...base, exclude_completed: true, exclude_overdue: true };
	}
	return { ...rest, unassigned: true, exclude_completed: true, sort_soonest: true };
}

export default async function handler(req, res) {
  try {
    await withAuth(req, res, async (session, navPermissions) => {
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'no-store');
        const { today, counts_only } = req.query;
        if (isHiddenPropertyId(req.query.property_id)) {
          return res.json(counts_only === 'true' ? { counts: {} } : { data: [], counts: {} });
        }
        const scopeFilters = buildScopeFilters(req.query, session);
        const listFilters = applyTabFilter(scopeFilters, req.query, session);

        const rows = today === 'true' ? await getTasksForToday() : await getTasks(listFilters);
        const enriched = await enrichTasks(filterHiddenPropertyRows(rows));
        const limitedView = hasLimitedTasksView(session.user);
        let data = limitedView
          ? enriched.filter((t) => t.assignee === session.user.name).map(withChecklistUrl)
          : enriched.map(withChecklistUrl);
        data = sanitizeTasksForViewer(data, session.user, navPermissions);

        if (listFilters.sort_soonest) {
          data = sortTasksByDateAsc(data);
        } else if (listFilters.status === 'completed') {
          data = sortTasksByDateDesc(data);
        }

        if (counts_only === 'true') {
          const countRows = today === 'true'
            ? await getTasksForToday()
            : await getTasks(scopeFilters);
          const countEnriched = await enrichTasks(filterHiddenPropertyRows(countRows));
          const scoped = limitedView
            ? countEnriched.filter((t) => t.assignee === session.user.name)
            : countEnriched;
          return res.json({ counts: countTasksByIndicator(scoped) });
        }

        const countRows = today === 'true'
          ? await getTasksForToday()
          : await getTasks(scopeFilters);
        const countEnriched = await enrichTasks(filterHiddenPropertyRows(countRows));
        const scoped = limitedView
          ? countEnriched.filter((t) => t.assignee === session.user.name)
          : countEnriched;
        const counts = countTasksByIndicator(scoped);

        return res.json({ data, counts });
      }

      if (req.method === 'POST') {
        if (!isAdmin(session.user)) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        const { reservation_id, property_id, property_name, title, description,
                due_date, due_time, checkout_date, assignee, type, notes, status } = req.body;

        if (!property_id || !due_date || !title?.trim())
          return res.status(400).json({ error: 'property_id, due_date, and title are required' });
        if (isHiddenPropertyId(property_id)) {
          return res.status(404).json({ error: 'Property not found' });
        }

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
          scheduled_by: session.user?.name || session.user?.username || null,
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
