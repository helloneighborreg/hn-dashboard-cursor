#!/usr/bin/env python3
"""Apply under-review workflow + cleaner status UI patches."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def w(rel, content):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    print(f'wrote {rel}')

# --- new files ---
w('lib/taskHistory.js', Path(ROOT / 'lib/taskHistory.js').read_text() if (ROOT / 'lib/taskHistory.js').exists() else '''import { formatDateTime } from './dates';

export function applyTaskHistoryPatches(existing, updates, { now = () => new Date().toISOString() } = {}) {
\tconst patch = {};
\tconst ts = now();
\tif (updates.assignee !== undefined) {
\t\tconst prev = existing?.assignee?.trim() || '';
\t\tconst next = updates.assignee?.trim() || '';
\t\tif (next && next !== prev) patch.assigned_at = ts;
\t\telse if (!next) patch.assigned_at = null;
\t}
\tif (updates.status !== undefined) {
\t\tif (updates.status === 'under_review' && existing?.status !== 'under_review') {
\t\t\tpatch.submitted_at = ts;
\t\t\tif (!existing?.started_at) patch.started_at = ts;
\t\t} else if (updates.status !== 'under_review' && existing?.status === 'under_review') {
\t\t\tpatch.submitted_at = null;
\t\t}
\t\tif (updates.status === 'completed' && existing?.status !== 'completed') {
\t\t\tpatch.completed_at = ts;
\t\t\tpatch.approved_at = ts;
\t\t\tif (!existing?.started_at) patch.started_at = ts;
\t\t} else if (updates.status !== 'completed' && existing?.status === 'completed') {
\t\t\tpatch.completed_at = null;
\t\t\tpatch.approved_at = null;
\t\t}
\t}
\treturn patch;
}

export function buildTaskHistoryEntries() { return []; }
export function formatTaskHistoryTimestamp(value) { return formatDateTime(value); }
''')

w('components/TaskCleanerStatus.js', '''import clsx from 'clsx';
import { getCleanerTaskStatusMessage } from '../lib/constants';
import Badge from './Badge';

export default function TaskCleanerStatus({ task, compact = false, className }) {
\tconst status = getCleanerTaskStatusMessage(task);
\tif (!status) return null;
\treturn (
\t\t<div className={clsx('min-w-0', className)}>
\t\t\t<Badge label={status.label} variant={status.variant} />
\t\t\t{!compact && status.hint && (
\t\t\t\t<p className="text-xs text-muted mt-1 leading-snug">{status.hint}</p>
\t\t\t)}
\t\t</div>
\t);
}
''')

w('pages/tasks/under-review.js', '''import TasksPageView from '../../components/TasksPageView';
import { requireAuth } from '../../lib/auth';

export default function UnderReviewTasksPage() {
\treturn <TasksPageView />;
}

export const getServerSideProps = requireAuth(async () => ({ props: {} }));
''')

# TaskStatusWidgets
w('components/TaskStatusWidgets.js', '''import clsx from 'clsx';
import { StatusKindIcon } from './TaskStatusIndicator';

export const STATUS_WIDGETS = [
\t{ key: 'unassigned', label: 'Unassigned', countColor: 'text-gray-600' },
\t{ key: 'assigned', label: 'Assigned', countColor: 'text-amber-700' },
\t{ key: 'under_review', label: 'Under Review', cleanerLabel: 'Under Review', cleanerHint: 'Checklist received — awaiting approval', countColor: 'text-blue-700' },
\t{ key: 'completed', label: 'Completed', cleanerLabel: 'Complete', cleanerHint: 'Checklist approved', countColor: 'text-green-700' },
\t{ key: 'overdue', label: 'Overdue', countColor: 'text-red-600' },
];

export default function TaskStatusWidgets({ counts, onSelect, visibleKeys, clickableKeys, activeKey, cleanerView = false }) {
\tconst defaultClickable = ['unassigned', 'assigned', 'under_review', 'completed'];
\tconst clickable = new Set(clickableKeys ?? defaultClickable);
\tconst widgets = visibleKeys ? STATUS_WIDGETS.filter(({ key }) => visibleKeys.includes(key)) : STATUS_WIDGETS;
\treturn (
\t\t<div className="card mb-3 overflow-hidden">
\t\t\t<div className="flex divide-x divide-border overflow-x-auto">
\t\t\t\t{widgets.map(({ key, label, cleanerLabel, cleanerHint, countColor }) => {
\t\t\t\t\tconst isClickable = Boolean(onSelect && clickable.has(key));
\t\t\t\t\tconst isActive = activeKey === key;
\t\t\t\t\tconst Tag = isClickable ? 'button' : 'div';
\t\t\t\t\tconst displayLabel = cleanerView && cleanerLabel ? cleanerLabel : label;
\t\t\t\t\treturn (
\t\t\t\t\t\t<Tag key={key} type={isClickable ? 'button' : undefined} onClick={isClickable ? () => onSelect(key) : undefined} aria-pressed={isClickable ? isActive : undefined} title={cleanerView && cleanerHint ? cleanerHint : undefined} className={clsx('flex flex-1 items-center justify-center gap-1.5 px-3 py-2 min-w-[6.5rem] whitespace-nowrap', isClickable && 'cursor-pointer hover:bg-gray-50 transition-colors', isActive && 'bg-gray-50')}>
\t\t\t\t\t\t\t<StatusKindIcon kind={key} size={13} className="shrink-0" />
\t\t\t\t\t\t\t<span className={clsx('text-sm', isActive ? 'font-medium text-dark' : 'text-muted')}>{displayLabel}</span>
\t\t\t\t\t\t\t<span className={clsx('text-sm font-semibold tabular-nums', countColor)}>{counts[key] ?? 0}</span>
\t\t\t\t\t\t</Tag>
\t\t\t\t\t);
\t\t\t\t})}
\t\t\t</div>
\t\t</div>
\t);
}
''')

print('Run manual StrReplace on TaskItem/TasksPageView or extend script')
