import { StatusKindIcon } from './TaskStatusIndicator';

export const STATUS_WIDGETS = [
	{
		key: 'unassigned',
		label: 'Unassigned',
		border: 'border-red-100',
		bg: 'bg-red-50',
		text: 'text-red-700',
		activeRing: 'ring-red-300',
	},
	{
		key: 'assigned',
		label: 'Assigned',
		border: 'border-yellow-100',
		bg: 'bg-yellow-50',
		text: 'text-yellow-800',
		activeRing: 'ring-yellow-300',
	},
	{
		key: 'completed',
		label: 'Completed',
		border: 'border-green-100',
		bg: 'bg-green-50',
		text: 'text-green-700',
		activeRing: 'ring-green-300',
	},
	{
		key: 'overdue',
		label: 'Overdue',
		border: 'border-red-200',
		bg: 'bg-red-50',
		text: 'text-red-600',
		activeRing: 'ring-red-400',
	},
];

export default function TaskStatusWidgets({
	counts,
	onSelect,
	visibleKeys,
	clickableKeys,
	activeKey,
}) {
	const defaultClickable = ['unassigned', 'assigned', 'completed'];
	const clickable = new Set(clickableKeys ?? defaultClickable);
	const widgets = visibleKeys
		? STATUS_WIDGETS.filter(({ key }) => visibleKeys.includes(key))
		: STATUS_WIDGETS;
	const gridCols = widgets.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4';

	return (
		<div className={`grid grid-cols-2 ${gridCols} gap-3 sm:gap-4 mb-6 w-full`}>
			{widgets.map(({ key, label, border, bg, text, activeRing }) => {
				const isClickable = Boolean(onSelect && clickable.has(key));
				const isActive = activeKey === key;
				const Tag = isClickable ? 'button' : 'div';
				return (
					<Tag
						key={key}
						type={isClickable ? 'button' : undefined}
						onClick={isClickable ? () => onSelect(key) : undefined}
						aria-pressed={isClickable ? isActive : undefined}
						className={`card border p-3 sm:p-4 min-w-0 text-left ${border} ${bg}${
							isClickable ? ' cursor-pointer hover:brightness-[0.98] transition-[filter]' : ''
						}${isActive ? ` ring-2 ring-offset-1 ${activeRing}` : ''}`}
					>
						<div className="flex items-center gap-2 mb-2">
							<StatusKindIcon kind={key} size={16} />
							<p className={`text-xs font-medium uppercase tracking-wide opacity-80 ${text}`}>
								{label}
							</p>
						</div>
						<p className={`text-xl sm:text-2xl font-bold ${text}`}>{counts[key] ?? 0}</p>
					</Tag>
				);
			})}
		</div>
	);
}
