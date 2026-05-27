import { useMemo } from 'react';
import clsx from 'clsx';
import { fmt$ } from './format';
import { formatDateRange } from '../../lib/dates';
import { collectFeeColumnKeys } from '../../lib/hospitableFinancials';
import { useColumnVisibility } from './useColumnVisibility';
import { ToggleableTableHead, HiddenColumnsBar } from './ToggleableTableHead';

const FIXED_COLUMNS = [
	{ key: 'guest', label: 'Guest' },
	{ key: 'property', label: 'Property' },
	{ key: 'dates', label: 'Dates' },
];

const TOTAL_COLUMN = { key: 'total', label: 'Total' };

function fmtFeeCell(amount) {
	if (!amount) return '—';
	if (amount < 0) return `-${fmt$(Math.abs(amount))}`;
	return fmt$(amount);
}

export default function HospitableTransactionsTable({ reservations, summary }) {
	const feeColumns = useMemo(
		() => collectFeeColumnKeys(reservations),
		[reservations],
	);

	const allColumnKeys = useMemo(
		() => [...FIXED_COLUMNS.map((c) => c.key), ...feeColumns, TOTAL_COLUMN.key],
		[feeColumns],
	);

	const columnLabels = useMemo(() => {
		const labels = Object.fromEntries(FIXED_COLUMNS.map((c) => [c.key, c.label]));
		for (const label of feeColumns) labels[label] = label;
		labels[TOTAL_COLUMN.key] = TOTAL_COLUMN.label;
		return labels;
	}, [feeColumns]);

	const { isVisible, hide, show, hiddenColumns } = useColumnVisibility(allColumnKeys);

	const visibleFixedCount = FIXED_COLUMNS.filter((c) => isVisible(c.key)).length;

	if (!reservations?.length) {
		return (
			<p className="text-muted text-sm text-center py-10">
				No Hospitable reservations for the selected period.
			</p>
		);
	}

	return (
		<>
			<p className="text-xs text-muted mb-4">
				Each Hospitable fee type is shown in its own column. Click the icon beside a column name to hide it.
			</p>
			<HiddenColumnsBar columns={hiddenColumns} labels={columnLabels} onShow={show} />
			<div className="transactions-table-scroll">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border">
							{FIXED_COLUMNS.map(({ key, label }) =>
								isVisible(key) ? (
									<ToggleableTableHead
										key={key}
										label={label}
										onHide={() => hide(key)}
									/>
								) : null,
							)}
							{feeColumns.map((label) =>
								isVisible(label) ? (
									<ToggleableTableHead
										key={label}
										label={label}
										align="right"
										className="whitespace-nowrap"
										onHide={() => hide(label)}
									/>
								) : null,
							)}
							{isVisible(TOTAL_COLUMN.key) && (
								<ToggleableTableHead
									label={TOTAL_COLUMN.label}
									align="right"
									className="font-semibold"
									onHide={() => hide(TOTAL_COLUMN.key)}
								/>
							)}
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{reservations.map((r) => (
							<tr key={r.id} className="hover:bg-gray-50">
								{isVisible('guest') && (
									<td className="table-cell">
										<p className="font-medium text-dark">{r.guest_name || '—'}</p>
										<p className="text-xs text-muted font-mono">{r.code}</p>
									</td>
								)}
								{isVisible('property') && (
									<td className="table-cell text-xs text-muted truncate max-w-[140px]">{r.property_name}</td>
								)}
								{isVisible('dates') && (
									<td className="table-cell text-xs text-muted whitespace-nowrap">
										{formatDateRange(r.check_in, r.check_out, ' → ')}
									</td>
								)}
								{feeColumns.map((label) => {
									if (!isVisible(label)) return null;
									const amount = r.fees_by_label?.[label] || 0;
									return (
										<td
											key={label}
											className={clsx(
												'table-cell text-right',
												amount < 0 ? 'text-muted' : '',
											)}
										>
											{fmtFeeCell(amount)}
										</td>
									);
								})}
								{isVisible(TOTAL_COLUMN.key) && (
									<td className="table-cell text-right font-semibold text-green-600">{fmt$(r.revenue)}</td>
								)}
							</tr>
						))}
						<tr className="border-t-2 border-brand-200 bg-gray-50 font-semibold">
							<td className="table-cell" colSpan={Math.max(visibleFixedCount, 1)}>Totals</td>
							{feeColumns.map((label) => {
								if (!isVisible(label)) return null;
								const total = reservations.reduce(
									(sum, r) => sum + (r.fees_by_label?.[label] || 0),
									0,
								);
								return (
									<td
										key={label}
										className={clsx(
											'table-cell text-right',
											total < 0 ? 'text-muted' : '',
										)}
									>
										{fmtFeeCell(total)}
									</td>
								);
							})}
							{isVisible(TOTAL_COLUMN.key) && (
								<td className="table-cell text-right text-brand-600">{fmt$(summary?.total_revenue)}</td>
							)}
						</tr>
					</tbody>
				</table>
			</div>
		</>
	);
}
