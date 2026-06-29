/** In-app checklist routes (opened from Settings → Checklists). */
export const FORMS_NAV_PARENT = '/forms';

export const CHECKLIST_ITEMS = [
	{
		href: `${FORMS_NAV_PARENT}/cjc-turn-clean-checklist`,
		label: 'Turn Clean Checklist: Cascades',
		description: 'Turnover cleaning checklist for Cascades (CJC) properties.',
	},
	{
		href: `${FORMS_NAV_PARENT}/kwd-turn-clean-checklist`,
		label: 'Turn Clean Checklist: Kirkwood',
		description: 'Turnover cleaning checklist for Kirkwood (KWD502).',
	},
];
