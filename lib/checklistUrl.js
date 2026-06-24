import { getChecklistUrl } from './propertyChecklists';
import { resolvePropertyCode } from './codes';

/** Map internal task fields → checklist URL query parameter names (customize in env). */
const DEFAULT_PARAM_MAP = {
	property: 'property',
	guest: 'guest',
	reservation_id: 'reservation_id',
	task_id: 'task_id',
	checkout_date: 'checkout_date',
	assignee: 'assignee',
};

function getParamMap() {
	const raw = process.env.CHECKLIST_URL_PARAM_MAP || process.env.FILLOUT_URL_PARAM_MAP;
	if (!raw) return DEFAULT_PARAM_MAP;
	try {
		return { ...DEFAULT_PARAM_MAP, ...JSON.parse(raw) };
	} catch {
		return DEFAULT_PARAM_MAP;
	}
}

function appendChecklistParams(base, task) {
	const paramMap = getParamMap();
	const values = {
		property: resolvePropertyCode(task.property_name) || task.property_name,
		guest: task.guest_name,
		reservation_id: task.reservation_id,
		task_id: task.id,
		checkout_date: task.checkout_date || task.due_date,
		assignee: task.assignee,
	};

	const params = new URLSearchParams();
	for (const [field, paramKeyOrKeys] of Object.entries(paramMap)) {
		const v = values[field];
		if (v == null || String(v).trim() === '') continue;
		const keys = Array.isArray(paramKeyOrKeys) ? paramKeyOrKeys : [paramKeyOrKeys];
		for (const paramKey of keys) {
			if (!paramKey) continue;
			params.set(paramKey, String(v).trim());
		}
	}

	const qs = params.toString();
	if (!qs) return base;
	return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
}

/** Build the in-app checklist link for a task (property mapping or stored task.checklist_url). */
export function buildChecklistUrl(task) {
	const stored = task.checklist_url?.trim();
	const base = getChecklistUrl(task.property_name) || stored || null;

	if (!base) return null;
	return appendChecklistParams(base, task);
}

/** URL for viewing a completed checklist submission. */
export function buildCompletedChecklistUrl(task) {
	const stored = task.checklist_submission_url?.trim();
	if (stored) return stored;
	return null;
}

/** Attach computed checklist_url to a task row for API responses. */
export function withChecklistUrl(task) {
	if (!task) return task;
	return {
		...task,
		checklist_url: buildChecklistUrl(task),
		completed_checklist_url: buildCompletedChecklistUrl(task),
	};
}
