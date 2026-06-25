import { insertPropertyChangeLog } from './db';

const DETAILS_FIELD_SECTIONS = {
	rent: 'lease-information',
	lease_utilities: 'lease-information',
	lease_electric: 'lease-information',
	lease_internet: 'lease-information',
	lease_parking: 'lease-information',
	lease_expiration: 'lease-information',
	renewal_notice_due: 'lease-information',
	square_feet: 'property-details',
	year_built: 'property-details',
	mailbox: 'property-details',
	parking_number: 'property-details',
	parking_code: 'property-details',
	backup_lockbox_location: 'backup-info',
	backup_lockbox_code: 'backup-info',
	backup_date_confirmed: 'backup-info',
	backup_image_storage_path: 'backup-info',
	utilities_provider: 'utility-info',
	utilities_account_number: 'utility-info',
	internet_provider: 'utility-info',
	internet_account_number: 'utility-info',
	primary_cleaner: 'utility-info',
	base_cleaning_rate: 'utility-info',
	notes: 'notes',
};

function normalizeValue(value) {
	if (value === '' || value === undefined) return null;
	return value;
}

function valuesEqual(a, b) {
	return JSON.stringify(normalizeValue(a)) === JSON.stringify(normalizeValue(b));
}

/** Build { field, old, new } entries for fields present in patch. */
export function diffRecordChanges(before, patch) {
	const changes = [];
	for (const [field, newValue] of Object.entries(patch)) {
		const oldValue = before?.[field] ?? null;
		if (!valuesEqual(oldValue, newValue)) {
			changes.push({
				field,
				old: normalizeValue(oldValue),
				new: normalizeValue(newValue),
			});
		}
	}
	return changes;
}

export function inferDetailsSection(patch, explicitSection) {
	if (explicitSection) return explicitSection;
	const fields = Object.keys(patch);
	if (!fields.length) return 'property-details';
	const sections = [...new Set(fields.map((field) => DETAILS_FIELD_SECTIONS[field] || 'property-details'))];
	return sections.length === 1 ? sections[0] : 'property-details';
}

export async function logPropertyChange({
	propertyId,
	section,
	resource,
	changes,
	user,
}) {
	if (!changes?.length || !propertyId || !user?.username) return;
	try {
		await insertPropertyChangeLog({
			property_id: propertyId,
			section: section || 'property-details',
			resource: resource || 'details',
			changes,
			edited_by_username: user.username,
			edited_by_name: user.name || user.username,
		});
	} catch (err) {
		console.error('Property change log failed:', err.message);
	}
}
