import { permissionRoleKey } from './navPermissions';
import { isAdmin } from './roles';

/** Accordion sections on the property detail page (`pages/properties/[id].js`). */
export const PROPERTY_SECTION_ITEMS = [
	{ key: 'photos', label: 'Photos' },
	{ key: 'about', label: 'About' },
	{ key: 'amenities', label: 'Amenities' },
	{ key: 'owner-info', label: 'Owner Info' },
	{ key: 'owner-statements', label: 'Owner Statements' },
	{ key: 'property-details', label: 'Property Details' },
	{ key: 'lease-information', label: 'Lease Information' },
	{ key: 'backup-info', label: 'Backup Info' },
	{ key: 'utility-info', label: 'Utility Info' },
	{ key: 'notes', label: 'Notes' },
	{ key: 'links', label: 'Quick Links' },
];

export function propertySectionPermissionKey(sectionKey) {
	return `/properties/sections/${sectionKey}`;
}

export function propertySectionPermissionItems() {
	return PROPERTY_SECTION_ITEMS.map((section) => ({
		href: propertySectionPermissionKey(section.key),
		label: section.label,
		group: 'General',
		parentHref: '/properties',
	}));
}

export function propertySectionDefaultVisibility() {
	return Object.fromEntries(
		PROPERTY_SECTION_ITEMS.map((section) => [
			propertySectionPermissionKey(section.key),
			{ admin: true, nonAdmin: false },
		]),
	);
}

export function isPropertySectionVisible(sectionKey, role, permissions) {
	if (!role || !permissions) return false;
	const key = propertySectionPermissionKey(sectionKey);
	const perm = permissions[key] || { admin: true, nonAdmin: false };
	return perm[permissionRoleKey(role)] === true;
}

export function canEditPropertySections(user) {
	return isAdmin(user);
}
