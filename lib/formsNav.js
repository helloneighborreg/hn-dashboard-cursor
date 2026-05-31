/** Sidebar Forms section — external Fillout links (no in-app page). */
export const FORMS_NAV_PARENT = '/forms';

export const FORM_NAV_ITEMS = [
	{
		href: `${FORMS_NAV_PARENT}/extra-charge`,
		label: 'Extra Charge',
		externalUrl: 'https://helloneighbor.fillout.com/extracharges',
	},
	{
		href: `${FORMS_NAV_PARENT}/supply-request`,
		label: 'Supply Request',
		externalUrl: 'https://helloneighbor.fillout.com/supplyrestock',
	},
	{
		href: `${FORMS_NAV_PARENT}/maintenance-request`,
		label: 'Maintenance Request',
		externalUrl: 'https://helloneighbor.fillout.com/maintenance',
	},
];
