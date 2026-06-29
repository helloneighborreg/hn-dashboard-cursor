#!/usr/bin/env node
/**
 * Export a Fillout turn-clean checklist into lib/forms/*.schema.json.
 *
 * Usage: node scripts/export-fillout-checklist-schema.mjs <fillout-url> <output-slug> <display-name>
 * Example:
 *   node scripts/export-fillout-checklist-schema.mjs \
 *     https://helloneighbor.fillout.com/kirkwoodturncleanchecklist \
 *     kwd-turn-clean-checklist \
 *     "Turn Clean Checklist: Kirkwood"
 */
import fs from 'fs';
import path from 'path';

const [url, slug, name] = process.argv.slice(2);
if (!url || !slug || !name) {
	console.error('Usage: node scripts/export-fillout-checklist-schema.mjs <url> <slug> <name>');
	process.exit(1);
}

const STEP_ORDER_HINTS = {
	Details: 0,
	'Previous Guest': 1,
	Bedroom: 2,
	'Living Room': 3,
	Bathroom: 4,
	Kitchen: 5,
	Billing: 6,
};

const FIELD_TYPES = new Set([
	'Checkboxes', 'FileUpload', 'ShortAnswer', 'Dropdown', 'DatePicker', 'NumberInput', 'MultipleChoice', 'LongAnswer',
]);

function stripHtml(s) {
	return String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
}

function widgetToQuestion(w) {
	const label = stripHtml(w.template?.label?.logic?.value || w.name || '');
	const opts = (w.template?.options?.staticOptions || []).map((o) => ({
		id: o.id,
		value: stripHtml(o.value?.logic?.value || o.label?.logic?.value || ''),
		label: stripHtml(o.label?.logic?.value || o.value?.logic?.value || ''),
	}));
	const type = w.type === 'MultipleChoice' ? 'Dropdown' : (w.type === 'LongAnswer' ? 'ShortAnswer' : w.type);
	const q = { id: w.id, name: label, type };
	if (opts.length) q.options = opts;
	return q;
}

const html = await fetch(url).then((r) => r.text());
const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
if (!match) throw new Error('Could not find __NEXT_DATA__ on Fillout page');

const pageProps = JSON.parse(match[1]).props.pageProps;
const flow = pageProps.flow;
const steps = pageProps.flowSnapshot.template.steps;

const orderedStepIds = Object.entries(steps)
	.sort(([idA, a], [idB, b]) => (STEP_ORDER_HINTS[a.name] ?? 99) - (STEP_ORDER_HINTS[b.name] ?? 99))
	.map(([id]) => id);

const questions = [];
const seen = new Set();
for (const stepId of orderedStepIds) {
	const step = steps[stepId];
	const ordered = Object.values(step.template?.widgets || {}).sort((a, b) => {
		const ar = a.position?.row ?? 0;
		const br = b.position?.row ?? 0;
		if (ar !== br) return ar - br;
		return (a.position?.column ?? 0) - (b.position?.column ?? 0);
	});
	for (const w of ordered) {
		if (!FIELD_TYPES.has(w.type)) continue;
		if (seen.has(w.id)) continue;
		seen.add(w.id);
		questions.push(widgetToQuestion(w));
	}
}

const schema = {
	id: flow.publicIdentifier,
	name,
	slug,
	urlParameters: [
		{ id: 'ReservationID', name: 'ReservationID' },
		{ id: 'Guest', name: 'Guest' },
		{ id: 'Property', name: 'Property' },
		{ id: 'CheckOut', name: 'CheckOut' },
		{ id: 'id', name: 'id' },
		{ id: 'TaskID', name: 'TaskID' },
	],
	calculations: [{ id: 'svxB', name: 'Invoice Total', type: 'number' }],
	questions,
};

const outPath = path.join('lib', 'forms', `${slug.replace(/-turn-clean-checklist$/, '')}TurnCleanChecklist.schema.json`);
const fileName = slug.includes('kwd')
	? 'kwdTurnCleanChecklist.schema.json'
	: slug.includes('cjc')
		? 'cjcTurnCleanChecklist.schema.json'
		: `${slug}.schema.json`;

const resolved = path.join('lib', 'forms', fileName);
fs.writeFileSync(resolved, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`Wrote ${resolved} (${questions.length} questions)`);
