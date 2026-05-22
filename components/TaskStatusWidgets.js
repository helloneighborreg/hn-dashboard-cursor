import { StatusKindIcon } from './TaskStatusIndicator';

export const STATUS_WIDGETS = [
	{
		key: 'unassigned',
		label: 'Unassigned',
		border: 'border-red-100',
		bg: 'bg-red-50',
		text: 'text-red-700',
	},
	{
		key: 'assigned',
		label: 'Assigned',
		border: 'border-yellow-100',
		bg: 'bg-yellow-50',
		text: 'text-yellow-800',
	},
	{
		key: 'completed',
		label: 'Completed',
		border: 'border-green-100',
		bg: 'bg-green-50',
		text: 'text-green-700',
	},
	{
		key: 'overdue',
		label: 'Overdue',
		border: 'border-red-200',
		bg: 'bg-red-50',
		text: 'text-red-600',
	},
];

export default function TaskStatusWidgets({ counts }) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 w-full">
			{STATUS_WIDGETS.map(({ key, label, border, bg, text }) => (
				<div key={key} className={`card border p-3 sm:p-4 min-w-0 ${border} ${bg}`}>
					<div className="flex items-center gap-2 mb-2">
						<StatusKindIcon kind={key} size={16} />
						<p className={`text-xs font-medium uppercase tracking-wide opacity-80 ${text}`}>
							{label}
						</p>
					</div>
					<p className={`text-xl sm:text-2xl font-bold ${text}`}>{counts[key] ?? 0}</p>
				</div>
			))}
		</div>
	);
}
