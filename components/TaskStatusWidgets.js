import clsx from 'clsx';
import { StatusKindIcon } from './TaskStatusIndicator';
import { TASK_TAB_LABELS, TASK_TAB_ORDER } from '../lib/taskRoutes';

export const STATUS_WIDGETS = TASK_TAB_ORDER.map((key) => {
	const base = { key, label: TASK_TAB_LABELS[key] };
	if (key === 'unassigned') return { ...base, countColor: 'text-gray-600' };
	if (key === 'assigned') return { ...base, countColor: 'text-amber-700' };
	if (key === 'completed') {
		return {
			...base,
			countColor: 'text-green-700',
			cleanerLabel: 'Complete',
			hint: 'Checklist approved.',
		};
	}
	if (key === 'under_review') {
		return {
			...base,
			countColor: 'text-blue-700',
			cleanerLabel: 'Review',
			hint: 'Checklist received — waiting for approval.',
		};
	}
	return { ...base, countColor: 'text-red-600' };
});

export default function TaskStatusWidgets({
	counts,
	onSelect,
	visibleKeys,
	clickableKeys,
	activeKey,
	cleanerView = false,
}) {
	const defaultClickable = TASK_TAB_ORDER.filter((key) => key !== 'overdue');
	const clickable = new Set(clickableKeys ?? defaultClickable);
	const widgets = visibleKeys
		? STATUS_WIDGETS.filter(({ key }) => visibleKeys.includes(key))
		: STATUS_WIDGETS;

	return (
		<div className="card mb-3 overflow-hidden">
			<div className="flex divide-x divide-border overflow-x-auto">
				{widgets.map(({ key, label, countColor, cleanerLabel, hint }) => {
					const isClickable = Boolean(onSelect && clickable.has(key));
					const isActive = activeKey === key;
					const Tag = isClickable ? 'button' : 'div';
					const displayLabel = cleanerView && cleanerLabel ? cleanerLabel : label;

					return (
						<Tag
							key={key}
							type={isClickable ? 'button' : undefined}
							onClick={isClickable ? () => onSelect(key) : undefined}
							aria-pressed={isClickable ? isActive : undefined}
							title={cleanerView && hint ? hint : undefined}
							className={clsx(
								'flex flex-1 flex-col items-center justify-center gap-0.5 px-3 py-2 min-w-[6.5rem] whitespace-nowrap',
								isClickable && 'cursor-pointer hover:bg-gray-50 transition-colors',
								isActive && 'bg-gray-50',
							)}
						>
							<div className="flex items-center justify-center gap-1.5">
								<StatusKindIcon kind={key} size={13} className="shrink-0" />
								<span className={clsx('text-sm', isActive ? 'font-medium text-dark' : 'text-muted')}>
									{displayLabel}
								</span>
								<span className={clsx('text-sm font-semibold tabular-nums', countColor)}>
									{counts[key] ?? 0}
								</span>
							</div>
							{cleanerView && hint && (
								<span className="text-[10px] text-muted leading-tight text-center max-w-[9rem]">
									{hint}
								</span>
							)}
						</Tag>
					);
				})}
			</div>
		</div>
	);
}
