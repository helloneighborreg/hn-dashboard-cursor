import { useMemo, useState } from 'react';
import {
	format,
	startOfMonth,
	endOfMonth,
	startOfWeek,
	endOfWeek,
	eachDayOfInterval,
	isSameMonth,
	isToday,
	addMonths,
	subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { getTaskStatusIndicator, sortTasksByDateDesc } from '../lib/constants';
import { formatDate } from '../lib/dates';
import { taskHeadline, formatClock } from '../lib/taskDisplay';
import { taskHasPets, taskPetLabel } from '../lib/reservationPets';
import TaskStatusIndicator from './TaskStatusIndicator';
import TaskPetIndicator from './TaskPetIndicator';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

const CHIP_CLASS = {
	completed: 'bg-green-100 text-green-900 border-green-200',
	assigned: 'bg-yellow-100 text-yellow-900 border-yellow-200',
	unassigned: 'bg-red-100 text-red-900 border-red-200',
	overdue: 'bg-red-50 text-red-800 border-red-300',
};

function TaskChip({ task, onSelect }) {
	const { kind } = getTaskStatusIndicator(task);
	return (
		<button
			type="button"
			onClick={() => onSelect?.(task)}
			className={clsx(
				'w-full text-left rounded px-1.5 py-0.5 text-[10px] leading-tight border truncate transition-opacity hover:opacity-80',
				CHIP_CLASS[kind],
			)}
			title={`${taskHeadline(task)} · due ${formatClock(task.due_time || '16:00')}${taskHasPets(task) ? ` · ${taskPetLabel(task)}` : ''}`}
		>
			<span className="inline-flex items-center gap-0.5 max-w-full min-w-0">
				{taskHasPets(task) && <TaskPetIndicator task={task} size={10} className="opacity-90" />}
				<span className="truncate">{taskHeadline(task)}</span>
			</span>
		</button>
	);
}

function DayOverflowModal({ dateLabel, tasks, onSelect, onClose }) {
	if (!tasks?.length) return null;
	return (
		<>
			<div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
			<div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs bg-white rounded-xl shadow-2xl p-4">
				<p className="text-sm font-semibold text-dark mb-3">{dateLabel}</p>
				<div className="space-y-1.5 max-h-64 overflow-y-auto">
					{tasks.map((task) => (
						<TaskChip
							key={task.id}
							task={task}
							onSelect={(t) => {
								onClose();
								onSelect?.(t);
							}}
						/>
					))}
				</div>
			</div>
		</>
	);
}

export default function TaskCalendarView({ tasks, month, onMonthChange, onTaskSelect }) {
	const [overflowDay, setOverflowDay] = useState(null);
	const days = useMemo(() => {
		const monthStart = startOfMonth(month);
		const monthEnd = endOfMonth(month);
		const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
		const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
		return eachDayOfInterval({ start: gridStart, end: gridEnd });
	}, [month]);

	const tasksByDate = useMemo(() => {
		const map = {};
		for (const task of tasks) {
			const key = task.due_date;
			if (!key) continue;
			if (!map[key]) map[key] = [];
			map[key].push(task);
		}
		for (const key of Object.keys(map)) {
			map[key] = sortTasksByDateDesc(map[key]);
		}
		return map;
	}, [tasks]);

	function goToday() {
		onMonthChange(startOfMonth(new Date()));
	}

	return (
		<div className="overflow-x-auto">
			{overflowDay && (
				<DayOverflowModal
					dateLabel={overflowDay.label}
					tasks={overflowDay.tasks}
					onSelect={onTaskSelect}
					onClose={() => setOverflowDay(null)}
				/>
			)}
			<div className="card overflow-hidden min-w-[36rem]">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border bg-gray-50">
				<div className="flex items-center gap-2 flex-wrap text-xs text-muted">
					<span className="inline-flex items-center gap-1"><TaskStatusIndicator task={{ status: 'unassigned' }} /> Unassigned</span>
					<span className="inline-flex items-center gap-1"><TaskStatusIndicator task={{ status: 'assigned', assignee: 'x' }} /> Assigned</span>
					<span className="inline-flex items-center gap-1"><TaskStatusIndicator task={{ status: 'completed' }} /> Completed</span>
					<span className="inline-flex items-center gap-1"><TaskStatusIndicator task={{ due_date: '2000-01-01', status: 'assigned', assignee: 'x' }} /> Overdue</span>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					<button type="button" onClick={goToday} className="btn-secondary text-sm py-1.5">
						Today
					</button>
					<div className="flex items-center border border-border rounded-lg overflow-hidden divide-x divide-border bg-white">
						<button
							type="button"
							onClick={() => onMonthChange(subMonths(month, 1))}
							className="px-2.5 py-2 hover:bg-gray-50 transition-colors text-dark"
							aria-label="Previous month"
						>
							<ChevronLeft size={16} />
						</button>
						<span className="px-4 py-2 text-sm font-medium text-dark whitespace-nowrap select-none min-w-[9rem] text-center">
							{format(month, 'MMMM yyyy')}
						</span>
						<button
							type="button"
							onClick={() => onMonthChange(addMonths(month, 1))}
							className="px-2.5 py-2 hover:bg-gray-50 transition-colors text-dark"
							aria-label="Next month"
						>
							<ChevronRight size={16} />
						</button>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-7 border-b border-border bg-white">
				{WEEKDAYS.map((day) => (
					<div key={day} className="py-2 text-center text-xs font-semibold text-muted uppercase tracking-wide">
						{day}
					</div>
				))}
			</div>

			<div className="grid grid-cols-7 auto-rows-fr min-h-[32rem]">
				{days.map((day) => {
					const dateStr = format(day, 'yyyy-MM-dd');
					const dayTasks = tasksByDate[dateStr] || [];
					const inMonth = isSameMonth(day, month);
					const today = isToday(day);

					return (
						<div
							key={dateStr}
							className={clsx(
								'min-h-[5.5rem] border-b border-r border-border p-1.5 flex flex-col gap-1',
								!inMonth && 'bg-gray-50/80',
								today && 'bg-brand-50/40 ring-1 ring-inset ring-brand-200',
							)}
						>
							<div className={clsx(
								'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
								today ? 'bg-brand-500 text-white' : inMonth ? 'text-dark' : 'text-muted',
							)}>
								{format(day, 'd')}
							</div>
							<div className="space-y-1 flex-1 min-h-0">
								{dayTasks.slice(0, MAX_CHIPS).map((task) => (
									<TaskChip key={task.id} task={task} onSelect={onTaskSelect} />
								))}
								{dayTasks.length > MAX_CHIPS && (
									<button
										type="button"
										onClick={() => setOverflowDay({
											label: formatDate(day),
											tasks: dayTasks.slice(MAX_CHIPS),
										})}
										className="text-[10px] text-brand-600 font-medium px-0.5 hover:underline"
									>
										+{dayTasks.length - MAX_CHIPS} more
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>
			</div>
		</div>
	);
}
