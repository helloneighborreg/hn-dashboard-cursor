import { buildPropertyMap, getProperties } from './hospitable';
import {
	buildPropertyCodeToNameMap,
	formatPropertyDisplayName,
	getPropertyDisplayName,
	resolvePropertyCode,
} from './codes';

const PLACEHOLDER_PROPERTY = 'Property';

function propertyNameFromTitle(title) {
	if (!title?.includes(' - ')) return '';
	const prop = title.split(' - ').slice(1).join(' - ').trim();
	if (!prop || prop === PLACEHOLDER_PROPERTY) return '';
	return prop;
}

function upgradeTaskTitle(title, propertyName) {
	if (!propertyName || !title?.includes(' - ')) return title;
	const reservationPart = title.split(' - ')[0]?.trim();
	const titleProperty = title.split(' - ').slice(1).join(' - ').trim();
	if (!reservationPart || !titleProperty) return title;

	const titleCode = resolvePropertyCode(titleProperty);
	const nameCode = resolvePropertyCode(propertyName);
	if (titleCode && nameCode && titleCode === nameCode) {
		return `${reservationPart} - ${propertyName}`;
	}
	if (titleProperty.toUpperCase() === nameCode) {
		return `${reservationPart} - ${propertyName}`;
	}
	return title;
}

/** Fill missing/placeholder property_name from property_id or title; prefer full names. */
export function enrichTaskRow(task, propMap = {}, codeToNameMap = {}) {
	if (!task) return task;

	let property_name = task.property_name?.trim() || '';
	if (property_name === PLACEHOLDER_PROPERTY) property_name = '';

	if (task.property_id && propMap[task.property_id]) {
		property_name = getPropertyDisplayName(propMap[task.property_id]) || property_name;
	}

	if (!property_name) {
		property_name = propertyNameFromTitle(task.title) || '';
	}

	property_name = formatPropertyDisplayName(property_name, codeToNameMap);

	const title = upgradeTaskTitle(task.title, property_name);
	const changed = property_name !== task.property_name || title !== task.title;
	if (!changed) return task;

	return { ...task, property_name, title };
}

export async function enrichTasks(tasks) {
	if (!tasks?.length) return tasks || [];
	const properties = await getProperties();
	const propMap = buildPropertyMap(properties);
	const codeToNameMap = buildPropertyCodeToNameMap(properties);
	return tasks.map((task) => enrichTaskRow(task, propMap, codeToNameMap));
}
