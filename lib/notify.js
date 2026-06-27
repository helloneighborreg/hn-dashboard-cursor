import { getAdminNotifyEmails, getAssigneeContact, findDashboardUserForAssignee, getAdminUsernames } from './auth';
import { fetchWithTimeout } from './httpFetch';
import { sendPushToUsernames } from './webPush';
import { formatTaskStatus } from './constants';
import { buildChecklistUrl, buildCompletedChecklistUrl, withChecklistUrl } from './checklistUrl';
import { enrichTasks } from './taskEnrich';
import { formatClock, formatDateShort } from './taskDisplay';
import {
	formatChangeLine,
	formatCheckinSchedule,
	formatCheckoutSchedule,
	formatDueSchedule,
	getBookingChanges,
	taskScheduleChanged,
} from './taskSchedule';

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
	return formatCheckoutSchedule(task);
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

export async function sendEmail(to, subject, { text, html }) {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.TASK_NOTIFY_FROM_EMAIL;
	if (!apiKey || !from) return false;

	const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
	if (!recipients.length) return false;

	try {
		const res = await fetchWithTimeout('https://api.resend.com/emails', {
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
	} catch (err) {
		console.error('Resend email error:', err?.message || err);
		return false;
	}
}

async function sendSms(to, body) {
	const sid = process.env.TWILIO_ACCOUNT_SID;
	const token = process.env.TWILIO_AUTH_TOKEN;
	const from = process.env.TWILIO_FROM_NUMBER;
	if (!sid || !token || !from) return false;

	const params = new URLSearchParams({ To: to, From: from, Body: body });
	try {
		const res = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
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
	} catch (err) {
		console.error('Twilio SMS error:', err?.message || err);
		return false;
	}
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

function usernamesForAssignee(assignee) {
	const user = findDashboardUserForAssignee(assignee);
	return user?.username ? [user.username] : [];
}

async function maybeSendAssigneePush(assignee, { title, body, url = '/tasks/assigned' } = {}) {
	const usernames = usernamesForAssignee(assignee);
	if (!usernames.length) return { sent: 0, skipped: true, reason: 'no_user' };
	return sendPushToUsernames(usernames, { title, body, url });
}

async function maybeSendAdminPush({ title, body, url = '/tasks/completed' } = {}) {
	return sendPushToUsernames(getAdminUsernames(), { title, body, url });
}

function scheduleChangeIntro(hasScheduleChange) {
	return hasScheduleChange
		? 'Hello Neighbor — task schedule updated'
		: 'Hello Neighbor — task details updated';
}

function scheduleChangeTextBlock(previousTask, task) {
	const changes = getBookingChanges(previousTask, task);
	if (!changes.length) return [];

	return [
		'What changed:',
		...changes.map((change) => `• ${formatChangeLine(change)}`),
		'',
		'Current schedule:',
		`Check-in: ${formatCheckinSchedule(task)}`,
		`Checkout: ${formatCheckoutSchedule(task)}`,
		`Due: ${formatDueSchedule(task)}`,
	];
}

function scheduleChangeHtmlBlock(previousTask, task) {
	const changes = getBookingChanges(previousTask, task);
	if (!changes.length) return [];

	const changeItems = changes.map((change) => [
		'<li>',
		`<strong>${escapeHtml(change.label)}:</strong> `,
		`<del style="color:#6b7280">${escapeHtml(change.before)}</del> `,
		'→ ',
		`<strong style="color:#15803d">${escapeHtml(change.after)}</strong>`,
		'</li>',
	].join(''));

	return [
		'<p><strong>What changed:</strong></p>',
		`<ul style="margin:0 0 1em;padding-left:1.25em">${changeItems.join('')}</ul>`,
		'<p><strong>Current schedule:</strong></p>',
		`<p>Check-in: ${escapeHtml(formatCheckinSchedule(task))}</p>`,
		`<p>Checkout: ${escapeHtml(formatCheckoutSchedule(task))}</p>`,
		`<p>Due: ${escapeHtml(formatDueSchedule(task))}</p>`,
	];
}

function scheduleChangeMessage(task, previousTask, { includeAssignee = false } = {}) {
	const checklist = buildChecklistUrl(task);
	const hasScheduleChange = taskScheduleChanged(previousTask, task);
	const lines = [
		scheduleChangeIntro(hasScheduleChange),
		'',
		task.title,
		`Property: ${task.property_name || '—'}`,
		`Guest: ${guestLabel(task)}`,
	];

	if (includeAssignee) {
		lines.push(`Assignee: ${task.assignee?.trim() || 'Unassigned'}`);
	}

	lines.push('', ...scheduleChangeTextBlock(previousTask, task));

	if (checklist) lines.push('', `Open Checklist: ${checklist}`);

	return lines.join('\n');
}

function scheduleChangeMessageHtml(task, previousTask, { includeAssignee = false } = {}) {
	const checklist = buildChecklistUrl(task);
	const checklistBlock = checklist
		? `<p><a href="${escapeHtml(checklist)}">Open Checklist</a></p>`
		: '';
	const hasScheduleChange = taskScheduleChanged(previousTask, task);

	const blocks = [
		`<p>${escapeHtml(scheduleChangeIntro(hasScheduleChange))}</p>`,
		`<p><strong>${escapeHtml(task.title)}</strong></p>`,
		`<p>Property: ${escapeHtml(task.property_name || '—')}</p>`,
		`<p>Guest: ${escapeHtml(guestLabel(task))}</p>`,
	];

	if (includeAssignee) {
		blocks.push(`<p>Assignee: ${escapeHtml(task.assignee?.trim() || 'Unassigned')}</p>`);
	}

	blocks.push(...scheduleChangeHtmlBlock(previousTask, task), checklistBlock);

	return blocks.join('\n');
}

/** Deduped To: list — assignee (if any) plus all admin notify emails. */
function bookingChangeEmailRecipients(assignee) {
	const emails = new Set(getAdminNotifyEmails());
	if (assignee) {
		const contact = getAssigneeContact(assignee);
		if (contact?.email) emails.add(contact.email);
	}
	return [...emails];
}

async function sendBookingChangeEmail(task, previousTask, assignee, { subject }) {
	const recipients = bookingChangeEmailRecipients(assignee);
	if (!recipients.length) {
		console.warn(
			'Task change notify: set TASK_CHANGE_NOTIFY_EMAIL, TASK_COMPLETION_NOTIFY_EMAIL, admin email on DASHBOARD_USERS, or assignee email',
		);
		return { emailed: false, recipients: [], skipped: true, reason: 'no_recipient' };
	}

	if (!emailConfigured()) {
		console.warn('Task change notify: set RESEND_API_KEY and TASK_NOTIFY_FROM_EMAIL to send email');
		return { emailed: false, recipients, skipped: true, reason: 'email_not_configured' };
	}

	const emailed = await sendEmail(recipients, subject, {
		text: scheduleChangeMessage(task, previousTask, { includeAssignee: true }),
		html: scheduleChangeMessageHtml(task, previousTask, { includeAssignee: true }),
	});

	return {
		emailed,
		recipients,
		skipped: !emailed,
		reason: emailed ? null : 'delivery_failed',
	};
}

async function sendAssigneeScheduleSms(assignee, smsBody) {
	if (!assignee) return { texted: false, skipped: true, reason: 'no_assignee' };

	const contact = getAssigneeContact(assignee);
	if (!contact?.phone) {
		return { texted: false, skipped: true, reason: 'no_phone' };
	}

	if (!smsConfigured()) {
		console.warn('Task notify: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to send SMS');
		return { texted: false, skipped: true, reason: 'sms_not_configured' };
	}

	const texted = await sendSms(contact.phone, smsBody);
	return {
		texted,
		skipped: !texted,
		reason: texted ? null : 'delivery_failed',
	};
}

function skipFinishedTask(task) {
	if (task?.status === 'completed') {
		return { emailed: false, texted: false, skipped: true, reason: task.status };
	}
	return null;
}

/**
 * Notify assignee by email and/or SMS when a task is newly assigned.
 * Contacts: TASK_ASSIGNEE_CONTACTS and/or email/phone on DASHBOARD_USERS entries.
 */
export async function notifyTaskAssigned(task, assignee) {
	if (!assignee) return { emailed: false, texted: false, skipped: true, reason: 'no_assignee' };
	const skip = skipFinishedTask(task);
	if (skip) return skip;

	const subject = `Task assigned: ${task.title}`;
	const text = assignmentMessage(task);
	const html = assignmentMessageHtml(task);
	const checklist = buildChecklistUrl(task);
	const smsBody = checklist
		? `${task.title} — ${task.property_name}, due ${formatDue(task)}. Checklist: ${checklist}`
		: `${task.title} — ${task.property_name}, due ${formatDue(task)}`;

	const delivered = await deliverToAssignee(assignee, { subject, text, html, smsBody });
	const push = await maybeSendAssigneePush(assignee, {
		title: 'Task assigned',
		body: `${task.title} — ${task.property_name || 'Property'}, due ${formatDue(task)}`,
	});

	return { ...delivered, push };
}

/**
 * Notify assignee (if any) and admins when booking details change on a task.
 * One email to everyone on the To: line; SMS still goes to the assignee only.
 */
export async function notifyTaskBookingChanged(task, previousTask, assignee = null) {
	const skip = skipFinishedTask(task);
	if (skip) return { assignee: skip, admin: skip, email: skip };

	const hasScheduleChange = taskScheduleChanged(previousTask, task);
	const subject = hasScheduleChange
		? `Task rescheduled: ${task.title}`
		: `Task updated: ${task.title}`;
	const changes = getBookingChanges(previousTask, task).map(formatChangeLine).join('; ');
	const checklist = buildChecklistUrl(task);
	const smsBody = checklist
		? `${task.title} — schedule updated (${changes}). Checklist: ${checklist}`
		: `${task.title} — schedule updated (${changes}). Due ${formatDueSchedule(task)}`;

	const email = await sendBookingChangeEmail(task, previousTask, assignee, { subject });
	const sms = await sendAssigneeScheduleSms(assignee, smsBody);
	const push = assignee
		? await maybeSendAssigneePush(assignee, {
			title: hasScheduleChange ? 'Task rescheduled' : 'Task updated',
			body: `${task.title} — ${changes || formatDueSchedule(task)}`,
		})
		: { sent: 0, skipped: true, reason: 'no_assignee' };

	const assigneeEmail = assignee ? getAssigneeContact(assignee)?.email : '';
	const assigneeOnEmail = Boolean(assigneeEmail && email.recipients?.includes(assigneeEmail));

	const sharedEmail = {
		emailed: email.emailed,
		skipped: email.skipped,
		reason: email.reason,
		recipients: email.recipients,
	};

	return {
		email: sharedEmail,
		push,
		assignee: {
			emailed: assigneeOnEmail && email.emailed,
			texted: sms.texted,
			pushed: push.sent > 0,
			skipped: !assigneeOnEmail && !sms.texted && !email.emailed && push.sent === 0,
			reason: assigneeOnEmail || sms.texted || email.emailed || push.sent > 0 ? null : email.reason || sms.reason,
		},
		admin: sharedEmail,
	};
}

/**
 * Notify assignee when checkout or due date/time changes on an assigned task.
 */
export async function notifyTaskScheduleChanged(task, assignee, previousTask) {
	return notifyTaskBookingChanged(task, previousTask, assignee);
}

export function taskBecameCompleted(before, after) {
	return before?.status !== 'completed' && after?.status === 'completed';
}

function completionLinks(task) {
	const pdf = task.checklist_pdf_url?.trim() || null;
	const completedChecklist = buildCompletedChecklistUrl(task);
	return { pdf, completedChecklist };
}

function completionMessage(task) {
	const { pdf, completedChecklist } = completionLinks(task);
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

	if (pdf || completedChecklist) lines.push('');
	if (pdf) lines.push(`View PDF: ${pdf}`);
	if (completedChecklist) lines.push(`View completed checklist: ${completedChecklist}`);

	return lines.join('\n');
}

function completionMessageHtml(task) {
	const { pdf, completedChecklist } = completionLinks(task);
	const linkBlocks = [];
	if (pdf) linkBlocks.push(`<p><a href="${escapeHtml(pdf)}">View PDF</a></p>`);
	if (completedChecklist) {
		linkBlocks.push(`<p><a href="${escapeHtml(completedChecklist)}">View completed checklist</a></p>`);
	}

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

function checklistReviewBaseUrl() {
	return (process.env.DASHBOARD_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
}

function checklistReviewMessage(submission, task, flagged) {
	const base = checklistReviewBaseUrl();
	const submissionPath = submission?.id ? `/forms/cjc-turn-clean-checklist?submission_id=${submission.id}` : null;
	const checklistUrl = base && submissionPath ? `${base}${submissionPath}` : submissionPath;
	const property = submission?.property_code || task?.property_name || '—';
	const cleaner = submission?.cleaner_name || task?.assignee || '—';
	const guest = submission?.guest_name || task?.guest_name || '—';

	const lines = [
		'Hello Neighbor — checklist photo review needed',
		'',
		`Property: ${property}`,
		`Guest: ${guest}`,
		`Cleaner: ${cleaner}`,
		`${flagged.length} photo(s) may not match the expected area.`,
		'',
		'Flagged photos:',
	];

	for (const row of flagged) {
		lines.push(`- ${row.expected_area}: ${row.reason || row.detected_area || 'Mismatch'}`);
	}

	if (checklistUrl) lines.push('', `Review checklist: ${checklistUrl}`);
	return lines.join('\n');
}

function checklistReviewMessageHtml(submission, task, flagged) {
	const base = checklistReviewBaseUrl();
	const submissionPath = submission?.id ? `/forms/cjc-turn-clean-checklist?submission_id=${submission.id}` : null;
	const checklistUrl = base && submissionPath ? `${base}${submissionPath}` : submissionPath;
	const property = submission?.property_code || task?.property_name || '—';
	const cleaner = submission?.cleaner_name || task?.assignee || '—';
	const guest = submission?.guest_name || task?.guest_name || '—';

	const items = flagged.map((row) => (
		`<li><strong>${escapeHtml(row.expected_area)}:</strong> ${escapeHtml(row.reason || row.detected_area || 'Mismatch')}</li>`
	)).join('');

	return [
		'<p>Hello Neighbor — checklist photo review needed</p>',
		`<p>Property: ${escapeHtml(property)}</p>`,
		`<p>Guest: ${escapeHtml(guest)}</p>`,
		`<p>Cleaner: ${escapeHtml(cleaner)}</p>`,
		`<p>${flagged.length} photo(s) may not match the expected area.</p>`,
		`<ul style="margin:0;padding-left:1.25em">${items}</ul>`,
		checklistUrl ? `<p><a href="${escapeHtml(checklistUrl)}">Review checklist</a></p>` : '',
	].filter(Boolean).join('\n');
}

/** Email admins when AI photo review flags a checklist for manual review. */
export async function notifyChecklistNeedsReview(submission, { results = [], task = null } = {}) {
	const flagged = (results || []).filter((row) => row.flagged);
	if (!flagged.length) return { emailed: false, skipped: true, reason: 'nothing_flagged' };

	const recipients = getAdminNotifyEmails();
	if (!recipients.length) {
		console.warn('Checklist review notify: no admin recipients configured');
		return { emailed: false, skipped: true, reason: 'no_recipient' };
	}
	if (!emailConfigured()) {
		console.warn('Checklist review notify: set RESEND_API_KEY and TASK_NOTIFY_FROM_EMAIL');
		return { emailed: false, skipped: true, reason: 'email_not_configured' };
	}

	const property = submission?.property_code || task?.property_name || 'Checklist';
	const subject = `Checklist review needed: ${property}`;
	const emailed = await sendEmail(recipients, subject, {
		text: checklistReviewMessage(submission, task, flagged),
		html: checklistReviewMessageHtml(submission, task, flagged),
	});

	return {
		emailed,
		skipped: !emailed,
		reason: emailed ? null : 'delivery_failed',
	};
}

/**
 * Email configured recipients when a task is marked completed.
 * Recipients: TASK_COMPLETION_NOTIFY_EMAIL and/or admin emails on DASHBOARD_USERS.
 */
export async function notifyTaskCompleted(task) {
	const push = await maybeSendAdminPush({
		title: 'Task completed',
		body: `${task.title} — ${task.property_name || 'Property'}`,
	});

	const recipients = getAdminNotifyEmails();
	if (!recipients.length) {
		console.warn(
			'Task completion notify: set TASK_CHANGE_NOTIFY_EMAIL, TASK_COMPLETION_NOTIFY_EMAIL, or add email to admin DASHBOARD_USERS',
		);
		return { emailed: false, push, skipped: !push.sent, reason: push.sent ? null : 'no_recipient' };
	}

	if (!emailConfigured()) {
		console.warn('Task completion notify: set RESEND_API_KEY and TASK_NOTIFY_FROM_EMAIL to send email');
		return { emailed: false, push, skipped: !push.sent, reason: push.sent ? null : 'email_not_configured' };
	}

	const subject = `Task completed: ${task.title}`;
	const emailed = await sendEmail(recipients, subject, {
		text: completionMessage(task),
		html: completionMessageHtml(task),
	});

	return {
		emailed,
		push,
		skipped: !emailed && push.sent === 0,
		reason: emailed || push.sent > 0 ? null : 'delivery_failed',
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

function overdueMessage(task) {
	const checklist = buildChecklistUrl(task);
	const lines = [
		'Hello Neighbor — task overdue',
		'',
		task.title,
		`Property: ${task.property_name || '—'}`,
		`Guest: ${guestLabel(task)}`,
		`Assignee: ${task.assignee || '—'}`,
		`Checkout: ${formatCheckout(task)}`,
		`Due: ${formatDue(task)}`,
		`Status: ${formatTaskStatus(task.status)}`,
		'',
		'This task was not completed by the due date and time.',
	];

	if (checklist) lines.push('', `Open Checklist: ${checklist}`);

	return lines.join('\n');
}

function overdueMessageHtml(task) {
	const checklist = buildChecklistUrl(task);
	const checklistBlock = checklist
		? `<p><a href="${escapeHtml(checklist)}">Open Checklist</a></p>`
		: '';

	return [
		'<p>Hello Neighbor — task overdue</p>',
		`<p><strong>${escapeHtml(task.title)}</strong></p>`,
		`<p>Property: ${escapeHtml(task.property_name || '—')}</p>`,
		`<p>Guest: ${escapeHtml(guestLabel(task))}</p>`,
		`<p>Assignee: ${escapeHtml(task.assignee || '—')}</p>`,
		`<p>Checkout: ${escapeHtml(formatCheckout(task))}</p>`,
		`<p>Due: ${escapeHtml(formatDue(task))}</p>`,
		`<p>Status: ${escapeHtml(formatTaskStatus(task.status))}</p>`,
		'<p>This task was not completed by the due date and time.</p>',
		checklistBlock,
	].join('\n');
}

/**
 * Notify assignee and admins when a task is past its due date/time and still open.
 * One email to assignee + admins; SMS to assignee; push to both.
 */
export async function notifyTaskOverdue(task, assignee = null) {
	const skip = skipFinishedTask(task);
	if (skip) return { assignee: skip, admin: skip, email: skip };

	const name = assignee || task?.assignee?.trim();
	if (!name) {
		return {
			assignee: { skipped: true, reason: 'no_assignee' },
			admin: { skipped: true, reason: 'no_assignee' },
			email: { skipped: true, reason: 'no_assignee' },
		};
	}

	const subject = `Task overdue: ${task.title}`;
	const text = overdueMessage(task);
	const html = overdueMessageHtml(task);
	const checklist = buildChecklistUrl(task);
	const smsBody = checklist
		? `${task.title} — overdue (due ${formatDue(task)}). Checklist: ${checklist}`
		: `${task.title} — overdue (due ${formatDue(task)})`;

	const recipients = bookingChangeEmailRecipients(name);
	let emailed = false;
	if (!recipients.length) {
		console.warn(
			'Task overdue notify: set TASK_CHANGE_NOTIFY_EMAIL, TASK_COMPLETION_NOTIFY_EMAIL, admin email on DASHBOARD_USERS, or assignee email',
		);
	} else if (!emailConfigured()) {
		console.warn('Task overdue notify: set RESEND_API_KEY and TASK_NOTIFY_FROM_EMAIL to send email');
	} else {
		emailed = await sendEmail(recipients, subject, { text, html });
	}

	const sms = await sendAssigneeScheduleSms(name, smsBody);
	const assigneePush = await maybeSendAssigneePush(name, {
		title: 'Task overdue',
		body: `${task.title} — due ${formatDue(task)}`,
		url: '/tasks/overdue',
	});
	const adminPush = await maybeSendAdminPush({
		title: 'Task overdue',
		body: `${task.title} — ${name}, due ${formatDue(task)}`,
		url: '/tasks/overdue',
	});

	const assigneeEmail = getAssigneeContact(name)?.email;
	const assigneeOnEmail = Boolean(assigneeEmail && recipients.includes(assigneeEmail));
	const delivered = emailed || sms.texted || assigneePush.sent > 0 || adminPush.sent > 0;

	return {
		email: {
			emailed,
			recipients,
			skipped: !emailed,
			reason: emailed ? null : (recipients.length ? 'delivery_failed' : 'no_recipient'),
		},
		assignee: {
			emailed: assigneeOnEmail && emailed,
			texted: sms.texted,
			pushed: assigneePush.sent > 0,
			skipped: !assigneeOnEmail && !sms.texted && !assigneePush.sent && !emailed,
			reason: delivered ? null : 'delivery_failed',
		},
		admin: {
			emailed,
			pushed: adminPush.sent > 0,
			skipped: !emailed && adminPush.sent === 0,
			reason: delivered ? null : 'delivery_failed',
		},
		delivered,
	};
}
