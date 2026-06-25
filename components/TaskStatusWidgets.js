import clsx from 'clsx';
import { StatusKindIcon, STATUS_KIND_COLORS } from './TaskStatusIndicator';

export const STATUS_WIDGETS = [
	{ key: 'unassigned', label: 'Unassigned' },
	{ key: 'assigned', label: 'Assigned' },
	{
		key: 'completed',
		label: 'Completed',
		cleanerLabel: 'Complete',
	},
	{ key: 'overdue', label: 'Overdue' },
];

export default function TaskStatusWidgets({
	counts,
	onSelect,
	visibleKeys,
	clickableKeys,
	activeKey,
	cleanerView = false,
}) {
	const defaultClickable = ['unassigned', 'assigned', 'completed'];
	const clickable = new Set(clickableKeys ?? defaultClickable);
	const widgets = visibleKeys
		? STATUS_WIDGETS.filter(({ key }) => visibleKeys.includes(key))
		: STATUS_WIDGETS;

	return (
		<div className="card mb-3 overflow-hidden">
			<div className="flex divide-x divide-border overflow-x-auto">
				{widgets.map(({ key, label, cleanerLabel, hint }) => {
					const countColor = STATUS_KIND_COLORS[key]?.count;
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
								'flex flex-1 flex-col items-center justify-center gap-1 px-3 py-2.5 min-w-[5.5rem]',
								isClickable && 'cursor-pointer hover:bg-gray-50 transition-colors',
								isActive && 'bg-gray-50',
							)}
						>
							<div className="flex items-center justify-center gap-1.5">
								<StatusKindIcon kind={key} size={13} className="shrink-0" />
								<span className={clsx(
									'text-xs leading-tight text-center',
									isActive ? 'font-medium text-dark' : 'text-muted',
								)}>
									{displayLabel}
								</span>
							</div>
							<span className={clsx('text-lg font-semibold tabular-nums leading-none', countColor ?? 'text-dark')}>
								{counts[key] ?? 0}
							</span>
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
