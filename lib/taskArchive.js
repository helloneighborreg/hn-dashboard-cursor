import { getSupabase } from './supabase.js';
import { todayIso } from './dates.js';
import { addDays, format } from 'date-fns';

export const TASK_ARCHIVE_AFTER_DAYS = 30;

export function taskArchiveCutoffIso(today = todayIso()) {
	const todayDate = new Date(`${today}T12:00:00`);
	return format(addDays(todayDate, -TASK_ARCHIVE_AFTER_DAYS), 'yyyy-MM-dd');
}

export function isTaskArchived(task) {
	return Boolean(task?.archived_at);
}

export function taskShouldBeArchived(task, cutoff = taskArchiveCutoffIso()) {
	const due = task?.due_date;
	if (!due) return false;
	return due < cutoff;
}

/** Set or clear archived_at from due_date relative to the archive cutoff. */
export function taskArchiveStatusPatch(task, cutoff = taskArchiveCutoffIso()) {
	if (taskShouldBeArchived(task, cutoff)) {
		if (task.archived_at) return {};
		return { archived_at: new Date().toISOString() };
	}
	if (task.archived_at) return { archived_at: null };
	return {};
}

export async function archiveStaleTasks() {
	const supabase = getSupabase();
	const cutoff = taskArchiveCutoffIso();
	const ts = new Date().toISOString();
	const { data, error } = await supabase
		.from('tasks')
		.update({ archived_at: ts, updated_at: ts })
		.is('archived_at', null)
		.lt('due_date', cutoff)
		.select('id');
	if (error) throw error;
	return { archived: data?.length ?? 0, cutoff };
}
