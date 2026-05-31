import { getAssigneeContact, getTaskCompletionNotifyEmails } from './auth';
import { formatTaskStatus } from './constants';
import { buildChecklistUrl, withChecklistUrl } from './checklistUrl';
import { enrichTasks } from './taskEnrich';
import { formatClock, formatDateShort } from './taskDisplay';
import { formatDueSchedule, scheduleChangeLines } from './taskSchedule';

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

	const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
	if (!recipients.length) return false;

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ from, to: recipients, subject, text, html }),
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

async function deliverToAssignee(assignee, { subject, text, html, smsBody }) {
	if (!assignee) return { emailed: false, texted: false, skipped: true, reason: 'no_assignee' };

	const contact = getAssigneeContact(assignee);
	if (!contact?.email && !contact?.phone) {
		console.warn(
			`Task notify: no contact for "${assignee}" — add email/phone to DASHBOARD_USERS or TASK_ASSIGNEE_CONTACTS`,
		);
		return { emailed: false, texted: false, skipped: true, reason: 'no_contact' };
	}

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

function scheduleChangeMessage(task, previousTask) {
	const checklist = buildChecklistUrl(task);
	const lines = [
		'Hello Neighbor — task schedule updated',
		'',
		task.title,
		`Property: ${task.property_name || '—'}`,
		`Guest: ${guestLabel(task)}`,
		...scheduleChangeLines(previousTask, task),
	];

	if (checklist) lines.push('', `Open Checklist: ${checklist}`);

	return lines.join('\n');
}

function scheduleChangeMessageHtml(task, previousTask) {
	const checklist = buildChecklistUrl(task);
	const checklistBlock = checklist
		? `<p><a href="${escapeHtml(checklist)}">Open Checklist</a></p>`
		: '';

	return [
		'<p>Hello Neighbor — task schedule updated</p>',
		`<p><strong>${escapeHtml(task.title)}</strong></p>`,
		`<p>Property: ${escapeHtml(task.property_name || '—')}</p>`,
		`<p>Guest: ${escapeHtml(guestLabel(task))}</p>`,
		...scheduleChangeLines(previousTask, task).map((line) => `<p>${escapeHtml(line)}</p>`),
		checklistBlock,
	].join('\n');
}

function skipCompletedTask(task) {
	if (task?.status === 'completed') {
		return { emailed: false, texted: false, skipped: true, reason: 'completed' };
	}
	return null;
}

/**
 * Notify assignee by email and/or SMS when a task is newly assigned.
 * Contacts: TASK_ASSIGNEE_CONTACTS and/or email/phone on DASHBOARD_USERS entries.
 */
export async function notifyTaskAssigned(task, assignee) {
	if (!assignee) return { emailed: false, texted: false, skipped: true, reason: 'no_assignee' };
	const skip = skipCompletedTask(task);
	if (skip) return skip;

	const subject = `Task assigned: ${task.title}`;
	const text = assignmentMessage(task);
	const html = assignmentMessageHtml(task);
	const checklist = buildChecklistUrl(task);
	const smsBody = checklist
		? `${task.title} — ${task.property_name}, due ${formatDue(task)}. Checklist: ${checklist}`
		: `${task.title} — ${task.property_name}, due ${formatDue(task)}`;

	return deliverToAssignee(assignee, { subject, text, html, smsBody });
}

/**
 * Notify assignee when checkout or due date/time changes on an assigned task.
 */
export async function notifyTaskScheduleChanged(task, assignee, previousTask) {
	if (!assignee) return { emailed: false, texted: false, skipped: true, reason: 'no_assignee' };
	const skip = skipCompletedTask(task);
	if (skip) return skip;

	const subject = `Task rescheduled: ${task.title}`;
	const text = scheduleChangeMessage(task, previousTask);
	const html = scheduleChangeMessageHtml(task, previousTask);
	const changes = scheduleChangeLines(previousTask, task).join('; ');
	const checklist = buildChecklistUrl(task);
	const smsBody = checklist
		? `${task.title} — schedule updated (${changes}). Checklist: ${checklist}`
		: `${task.title} — schedule updated (${changes}). Due ${formatDueSchedule(task)}`;

	return deliverToAssignee(assignee, { subject, text, html, smsBody });
}

export function taskBecameCompleted(before, after) {
	return before?.status !== 'completed' && after?.status === 'completed';
}

function completionMessage(task) {
	const checklist = buildChecklistUrl(task);
	const pdf = task.checklist_pdf_url?.trim() || null;
	const lines = [
		'Hello Neighbor — task completed',
		'',
		task.title,
		`Property: ${task.property_name || '—'}`,
		`Guest: ${guestLabel(task)}`,
		`Assignee: ${task.assignee || '—'}`,
		`Checkout: ${formatCheckout(task)}`,
		`Due: ${formatDue(task)}`,
	];

	if (checklist) lines.push('', `Open Checklist: ${checklist}`);
	if (pdf) lines.push(`View PDF: ${pdf}`);

	return lines.join('\n');
}

function completionMessageHtml(task) {
	const checklist = buildChecklistUrl(task);
	const pdf = task.checklist_pdf_url?.trim() || null;
	const linkBlocks = [];
	if (checklist) linkBlocks.push(`<p><a href="${escapeHtml(checklist)}">Open Checklist</a></p>`);
	if (pdf) linkBlocks.push(`<p><a href="${escapeHtml(pdf)}">View PDF</a></p>`);

	return [
		'<p>Hello Neighbor — task completed</p>',
		`<p><strong>${escapeHtml(task.title)}</strong></p>`,
		`<p>Property: ${escapeHtml(task.property_name || '—')}</p>`,
		`<p>Guest: ${escapeHtml(guestLabel(task))}</p>`,
		`<p>Assignee: ${escapeHtml(task.assignee || '—')}</p>`,
		`<p>Checkout: ${escapeHtml(formatCheckout(task))}</p>`,
		`<p>Due: ${escapeHtml(formatDue(task))}</p>`,
		...linkBlocks,
	].join('\n');
}

/**
 * Email configured recipients when a task is marked completed.
 * Recipients: TASK_COMPLETION_NOTIFY_EMAIL and/or admin emails on DASHBOARD_USERS.
 */
export async function notifyTaskCompleted(task) {
	const recipients = getTaskCompletionNotifyEmails();
	if (!recipients.length) {
		console.warn(
			'Task completion notify: set TASK_COMPLETION_NOTIFY_EMAIL or add email to admin DASHBOARD_USERS',
		);
		return { emailed: false, skipped: true, reason: 'no_recipient' };
	}

	if (!emailConfigured()) {
		console.warn('Task completion notify: set RESEND_API_KEY and TASK_NOTIFY_FROM_EMAIL to send email');
		return { emailed: false, skipped: true, reason: 'email_not_configured' };
	}

	const subject = `Task completed: ${task.title}`;
	const emailed = await sendEmail(recipients, subject, {
		text: completionMessage(task),
		html: completionMessageHtml(task),
	});

	return {
		emailed,
		skipped: !emailed,
		reason: emailed ? null : 'delivery_failed',
	};
}

/** Enrich task row and email completion notice when status transitions to completed. */
export async function notifyIfTaskCompleted(previousTask, updatedTask) {
	if (!taskBecameCompleted(previousTask, updatedTask)) return null;

	try {
		const [enrichedRow] = await enrichTasks([updatedTask]);
		const enriched = withChecklistUrl(enrichedRow);
		return await notifyTaskCompleted(enriched);
	} catch (err) {
		console.error('Task completion notify failed:', err.message);
		return { skipped: true, reason: 'error' };
	}
}
