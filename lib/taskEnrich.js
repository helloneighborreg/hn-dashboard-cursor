import { buildPropertyMap, getProperties, getPropertyCode } from './hospitable';
import { resolvePropertyCode } from './codes';

const PLACEHOLDER_PROPERTY = 'Property';

function propertyNameFromTitle(title) {
	if (!title?.includes(' - ')) return '';
	const prop = title.split(' - ').slice(1).join(' - ').trim();
	if (!prop || prop === PLACEHOLDER_PROPERTY) return '';
	return resolvePropertyCode(prop) || prop;
}

/** Fill missing/placeholder property_name from property_id or title. */
export function enrichTaskRow(task, propMap = {}) {
	if (!task) return task;

	let property_name = task.property_name?.trim() || '';
	if (property_name === PLACEHOLDER_PROPERTY) property_name = '';

	if (!property_name && task.property_id && propMap[task.property_id]) {
		property_name = getPropertyCode(propMap[task.property_id]) || '';
	}

	if (!property_name) {
		property_name = propertyNameFromTitle(task.title) || '';
	}

	if (!property_name || property_name === task.property_name) return task;
	return { ...task, property_name };
}

export async function enrichTasks(tasks) {
	if (!tasks?.length) return tasks || [];
	const properties = await getProperties();
	const propMap = buildPropertyMap(properties);
	return tasks.map((task) => enrichTaskRow(task, propMap));
}
