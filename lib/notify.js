import { getAssigneeContact } from './auth';
import { formatTaskStatus } from './constants';
import { buildChecklistUrl } from './checklistUrl';
import { formatClock, formatDateShort } from './taskDisplay';

function emailConfigured() {
	return Boolean(process.env.RESEND_API_KEY && process.env.TASK_NOTIFY_FROM_EMAIL);
}

function smsConfigured() {
	return Boolean(
		process.env.TWILIO_ACCOUNT_SID
		&& process.env.TWILIO_AUTH_TOKEN
		&& process.env.TWILIO_FROM_NUMBER,
	);
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function guestLabel(task) {
	return task.guest_name?.trim() || task.description?.trim() || '—';
}

function formatDue(task) {
	const date = formatDateShort(task.due_date);
	const time = formatClock(task.due_time || '16:00');
	return `${date} at ${time}`;
}

function formatCheckout(task) {
	const date = formatDateShort(task.checkout_date || task.due_date);
	const time = formatClock(task.start_time || '10:00');
	return `${date} (start ${time})`;
}

function assignmentMessage(task) {
	const checklist = buildChecklistUrl(task);
	const lines = [
		'Hello Neighbor — new task assignment',
		'',
		task.title,
		`Property: ${task.property_name || '—'}`,
		`Guest: ${guestLabel(task)}`,
		`Checkout: ${formatCheckout(task)}`,
		`Due: ${formatDue(task)}`,
		`Status: ${formatTaskStatus(task.status)}`,
	];

	if (checklist) lines.push('', `Open Checklist: ${checklist}`);

	return lines.join('\n');
}

function assignmentMessageHtml(task) {
	const checklist = buildChecklistUrl(task);
	const checklistBlock = checklist
		? `<p><a href="${escapeHtml(checklist)}">Open Checklist</a></p>`
		: '';

	return [
		'<p>Hello Neighbor — new task assignment</p>',
		`<p><strong>${escapeHtml(task.title)}</strong></p>`,
		`<p>Property: ${escapeHtml(task.property_name || '—')}</p>`,
		`<p>Guest: ${escapeHtml(guestLabel(task))}</p>`,
		`<p>Checkout: ${escapeHtml(formatCheckout(task))}</p>`,
		`<p>Due: ${escapeHtml(formatDue(task))}</p>`,
		`<p>Status: ${escapeHtml(formatTaskStatus(task.status))}</p>`,
		checklistBlock,
	].join('\n');
}

async function sendEmail(to, subject, { text, html }) {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.TASK_NOTIFY_FROM_EMAIL;
	if (!apiKey || !from) return false;

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ from, to: [to], subject, text, html }),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		console.error('Resend email failed:', res.status, body.slice(0, 200));
		return false;
	}
	return true;
}

async function sendSms(to, body) {
	const sid = process.env.TWILIO_ACCOUNT_SID;
	const token = process.env.TWILIO_AUTH_TOKEN;
	const from = process.env.TWILIO_FROM_NUMBER;
	if (!sid || !token || !from) return false;

	const params = new URLSearchParams({ To: to, From: from, Body: body });
	const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: params.toString(),
	});

	if (!res.ok) {
		const errBody = await res.text().catch(() => '');
		console.error('Twilio SMS failed:', res.status, errBody.slice(0, 200));
		return false;
	}
	return true;
}

/**
 * Notify assignee by email and/or SMS when a task is newly assigned.
 * Contacts: TASK_ASSIGNEE_CONTACTS and/or email/phone on DASHBOARD_USERS entries.
 */
export async function notifyTaskAssigned(task, assignee) {
	if (!assignee) return { emailed: false, texted: false, skipped: true, reason: 'no_assignee' };

	const contact = getAssigneeContact(assignee);
	if (!contact?.email && !contact?.phone) {
		console.warn(
			`Task notify: no contact for "${assignee}" — add email/phone to DASHBOARD_USERS or TASK_ASSIGNEE_CONTACTS`,
		);
		return { emailed: false, texted: false, skipped: true, reason: 'no_contact' };
	}

	const subject = `Task assigned: ${task.title}`;
	const text = assignmentMessage(task);
	const html = assignmentMessageHtml(task);
	const checklist = buildChecklistUrl(task);
	const smsBody = checklist
		? `${task.title} — ${task.property_name}, due ${formatDue(task)}. Checklist: ${checklist}`
		: `${task.title} — ${task.property_name}, due ${formatDue(task)}`;

	let emailed = false;
	let texted = false;

	if (contact.email) {
		if (!emailConfigured()) {
			console.warn('Task notify: set RESEND_API_KEY and TASK_NOTIFY_FROM_EMAIL to send email');
		} else {
			emailed = await sendEmail(contact.email, subject, { text, html });
		}
	}

	if (contact.phone) {
		if (!smsConfigured()) {
			console.warn('Task notify: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to send SMS');
		} else {
			texted = await sendSms(contact.phone, smsBody);
		}
	}

	return {
		emailed,
		texted,
		skipped: !emailed && !texted,
		reason: !emailed && !texted ? 'delivery_failed' : null,
	};
}
