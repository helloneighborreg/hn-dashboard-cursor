import clsx from 'clsx';
import { getStatementMonthOptions } from '../../lib/ownerStatementReport';

export default function OwnerStatementMonthPicker({
	selectedMonth,
	onSelect,
	onCancel,
	disabled = false,
}) {
	const months = getStatementMonthOptions();

	return (
		<div className="w-full">
			<p className="text-xs font-medium text-muted mb-2">Select statement month</p>
			<div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
				{months.map((month) => (
					<button
						key={month.value}
						type="button"
						onClick={() => onSelect(month.value)}
						disabled={disabled}
						className={clsx(
							'text-sm px-3 py-2 rounded-md border text-left transition-colors disabled:opacity-50',
							selectedMonth === month.value
								? 'border-primary bg-primary/5 text-dark font-medium'
								: 'border-border hover:bg-gray-50 text-dark',
						)}
					>
						{month.label}
					</button>
				))}
			</div>
			{onCancel && (
				<button
					type="button"
					onClick={onCancel}
					disabled={disabled}
					className="btn-secondary text-sm mt-2"
				>
					Cancel
				</button>
			)}
		</div>
	);
}
