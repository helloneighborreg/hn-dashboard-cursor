import { getSupabase } from './supabase.js';
import { getProperties } from './hospitable';
import { isAdmin, navItemsForRole, canViewReservationData } from './roles';
import { filterHiddenPropertyRows } from './hiddenProperties';
import { taskHeadline } from './taskDisplay';
import { formatDateOrDash } from './dates';

const RESULT_LIMIT = 8;

function sanitizeQuery(raw) {
	return String(raw || '').trim().replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

function navResults(q, role, navPermissions) {
	const items = navItemsForRole(role, navPermissions);
	const seen = new Set();
	const results = [];
	for (const item of items) {
		if (item.toggleOnly || item.externalUrl) continue;
		const haystack = `${item.label} ${item.href}`.toLowerCase();
		if (!haystack.includes(q)) continue;
		if (seen.has(item.href)) continue;
		seen.add(item.href);
		results.push({
			type: 'page',
			id: item.href,
			label: item.label,
			subtitle: 'Page',
			href: item.href,
		});
		if (results.length >= RESULT_LIMIT) break;
	}
	return results;
}

async function searchTasks(q, user, navPermissions) {
	const supabase = getSupabase();
	const pattern = `%${q}%`;
	const showReservation = canViewReservationData(user, navPermissions);
	const searchFields = showReservation
		? `guest_name.ilike.${pattern},property_name.ilike.${pattern},reservation_id.ilike.${pattern},assignee.ilike.${pattern},title.ilike.${pattern}`
		: `property_name.ilike.${pattern},assignee.ilike.${pattern},title.ilike.${pattern}`;
	let query = supabase
		.from('tasks')
		.select('id, property_name, guest_name, reservation_id, assignee, due_date, status, title, archived_at')
		.or(searchFields)
		.order('due_date', { ascending: true })
		.limit(RESULT_LIMIT);

	if (!isAdmin(user) && user?.name) {
		query = query.eq('assignee', user.name);
	}

	const { data, error } = await query;
	if (error) throw error;
	const headlineOptions = showReservation ? {} : { showReservationDetails: false };
	return filterHiddenPropertyRows(data || []).map((task) => ({
		type: 'task',
		id: task.id,
		label: taskHeadline(task, headlineOptions),
		subtitle: [
			task.assignee,
			formatDateOrDash(task.due_date),
			task.archived_at ? 'Archived' : '',
		].filter(Boolean).join(' · '),
		href: `/tasks/assigned?task=${task.id}`,
	}));
}

async function searchExpenses(q) {
	const supabase = getSupabase();
	const pattern = `%${q}%`;
	const { data, error } = await supabase
		.from('expenses')
		.select('id, vendor, property_name, category, date, amount, notes')
		.or(`vendor.ilike.${pattern},property_name.ilike.${pattern},category.ilike.${pattern},notes.ilike.${pattern}`)
		.order('date', { ascending: false })
		.limit(RESULT_LIMIT);
	if (error) throw error;
	return filterHiddenPropertyRows(data || []).map((expense) => ({
		type: 'expense',
		id: expense.id,
		label: expense.vendor || expense.category || 'Expense',
		subtitle: [expense.property_name, formatDateOrDash(expense.date)].filter(Boolean).join(' · '),
		href: '/transactions?tab=manual',
	}));
}

async function searchProperties(q) {
	const properties = await getProperties();
	return properties
		.filter((p) => {
			const haystack = [
				p.name,
				p.public_name,
				p.address?.display,
				p.address?.city,
				p.id,
			].filter(Boolean).join(' ').toLowerCase();
			return haystack.includes(q);
		})
		.slice(0, RESULT_LIMIT)
		.map((property) => ({
			type: 'property',
			id: property.id,
			label: property.public_name || property.name || 'Property',
			subtitle: property.address?.display || property.address?.city || 'Property',
			href: `/properties/${property.id}`,
		}));
}

export async function searchApp(rawQuery, { user, navPermissions } = {}) {
	const q = sanitizeQuery(rawQuery).toLowerCase();
	if (!q || q.length < 2) {
		return { query: rawQuery?.trim() || '', results: [] };
	}

	const results = [
		...navResults(q, user?.role, navPermissions),
		...(await searchTasks(q, user, navPermissions)),
	];

	if (isAdmin(user)) {
		const [expenses, properties] = await Promise.all([
			searchExpenses(q),
			searchProperties(q),
		]);
		results.push(...expenses, ...properties);
	}

	const deduped = [];
	const seen = new Set();
	for (const item of results) {
		const key = `${item.type}:${item.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(item);
	}

	return {
		query: sanitizeQuery(rawQuery),
		results: deduped.slice(0, 24),
	};
}
