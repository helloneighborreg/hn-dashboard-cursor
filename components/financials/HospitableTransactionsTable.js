import { useMemo } from 'react';
import clsx from 'clsx';
import { fmt$ } from './format';
import { formatDateRange } from '../../lib/dates';
import { collectFeeColumnKeys } from '../../lib/hospitableFinancials';
import { sortByKey } from '../../lib/tableSort';
import { useTableSort } from './useTableSort';
import { SortableTableHead } from './SortableTableHead';

const FIXED_COLUMNS = [
	{ key: 'guest', label: 'Guest' },
	{ key: 'property', label: 'Property' },
	{ key: 'dates', label: 'Dates' },
];

const TOTAL_COLUMN = { key: 'total', label: 'Total' };

const NUMERIC_KEYS = new Set([TOTAL_COLUMN.key]);

function fmtFeeCell(amount) {
	if (!amount) return '—';
	if (amount < 0) return `-${fmt$(Math.abs(amount))}`;
	return fmt$(amount);
}

function getReservationSortValue(reservation, key) {
	if (key === 'guest') return reservation.guest_name || reservation.code || '';
	if (key === 'property') return reservation.property_name || '';
	if (key === 'dates') return reservation.check_in || '';
	if (key === TOTAL_COLUMN.key) return reservation.revenue || 0;
	return reservation.fees_by_label?.[key] || 0;
}

export default function HospitableTransactionsTable({ reservations, summary }) {
	const feeColumns = useMemo(
		() => collectFeeColumnKeys(reservations),
		[reservations],
	);

	const numericKeys = useMemo(() => {
		const keys = new Set(NUMERIC_KEYS);
		for (const label of feeColumns) keys.add(label);
		return keys;
	}, [feeColumns]);

	const { sortKey, sortDir, toggleSort } = useTableSort('total', 'desc');

	const sortedReservations = useMemo(
		() => sortByKey(
			reservations,
			sortKey,
			sortDir,
			getReservationSortValue,
			{ numericKeys },
		),
		[reservations, sortKey, sortDir, numericKeys],
	);

	if (!reservations?.length) {
		return (
			<p className="text-muted text-sm text-center py-10">
				No Hospitable reservations for the selected period.
			</p>
		);
	}

	return (
		<div className="transactions-table-scroll">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-border">
						{FIXED_COLUMNS.map(({ key, label }) => (
							<SortableTableHead
								key={key}
								sortKey={key}
								label={label}
								active={sortKey === key}
								direction={sortDir}
								onSort={toggleSort}
								className={key === 'dates' ? 'table-head-date' : undefined}
							/>
						))}
						{feeColumns.map((label) => (
							<SortableTableHead
								key={label}
								sortKey={label}
								label={label}
								align="right"
								active={sortKey === label}
								direction={sortDir}
								onSort={toggleSort}
								className="whitespace-nowrap"
							/>
						))}
						<SortableTableHead
							sortKey={TOTAL_COLUMN.key}
							label={TOTAL_COLUMN.label}
							align="right"
							active={sortKey === TOTAL_COLUMN.key}
							direction={sortDir}
							onSort={toggleSort}
							className="font-semibold"
						/>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{sortedReservations.map((r) => (
						<tr key={r.id} className="hover:bg-gray-50">
							<td className="table-cell">
								<p className="font-medium text-dark">{r.guest_name || '—'}</p>
								<p className="text-xs text-muted font-mono">{r.code}</p>
							</td>
							<td className="table-cell text-xs text-muted truncate max-w-[140px]">{r.property_name}</td>
							<td className="table-cell-date text-muted">
								{formatDateRange(r.check_in, r.check_out, ' → ')}
							</td>
							{feeColumns.map((label) => {
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
							<td className="table-cell text-right font-semibold text-green-600">{fmt$(r.revenue)}</td>
						</tr>
					))}
					<tr className="border-t-2 border-brand-200 bg-gray-50 font-semibold">
						<td className="table-cell" colSpan={FIXED_COLUMNS.length}>Totals</td>
						{feeColumns.map((label) => {
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
						<td className="table-cell text-right text-brand-600">{fmt$(summary?.total_revenue)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
