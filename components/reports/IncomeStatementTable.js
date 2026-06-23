import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { fmtReport$ } from '../financials/format';
import ReportExportBar from './ReportExportBar';
import ReportDrilldownPanel from './ReportDrilldownPanel';
import { filterDrilldownItems } from '../../lib/reportDrilldown';
import { canExcludeTransaction, setTransactionExcluded } from '../../lib/bookkeepingClient';

const ROW_STYLES = {
	section: 'bg-white font-bold uppercase text-xs tracking-wide text-dark',
	subsection: 'bg-white font-semibold text-dark',
	line: 'bg-white text-dark',
	subtotal: 'bg-gray-50 font-semibold text-dark',
	section_total: 'bg-gray-100 font-bold text-dark',
	noi: 'bg-blue-50 font-bold text-dark',
	net_cash_flow: 'bg-green-50 font-bold text-dark',
	uncategorized: 'bg-red-50 font-bold text-dark',
};

function indentClass(indent) {
	if (indent >= 2) return 'pl-8';
	if (indent === 1) return 'pl-4';
	return 'pl-3';
}

function periodLabel(periods, periodKey) {
	if (periodKey === 'total') return 'Total';
	return periods.find((p) => p.key === periodKey)?.label || periodKey;
}

function AmountButton({ value, onClick }) {
	const n = Number(value) || 0;
	const clickable = n !== 0;

	if (!clickable) {
		return <span className="text-muted">{fmtReport$(0)}</span>;
	}

	return (
		<button
			type="button"
			onClick={onClick}
			className="text-brand-600 hover:text-brand-700 hover:underline underline-offset-2 font-medium"
			title="View transactions"
		>
			{fmtReport$(n)}
		</button>
	);
}

export default function IncomeStatementTable({ data, onRefresh, properties = [] }) {
	const [drilldown, setDrilldown] = useState(null);
	const [excludingId, setExcludingId] = useState(null);

	const items = useMemo(() => data?.drilldown_items || [], [data?.drilldown_items]);

	const drilldownItems = useMemo(() => {
		if (!drilldown?.rowId) return drilldown?.items || [];
		return filterDrilldownItems(items, {
			rowId: drilldown.rowId,
			periodKey: drilldown.periodKey,
		});
	}, [drilldown, items]);

	function openDrilldown(row, periodKey) {
		const amount = row.values?.[periodKey] ?? 0;
		if (!amount) return;

		setDrilldown({
			title: row.label,
			subtitle: periodLabel(data.periods, periodKey),
			rowId: row.id,
			periodKey,
		});
	}

	async function handleItemSaved() {
		await onRefresh?.();
	}

	async function excludeItem(item) {
		if (!canExcludeTransaction(item)) return;
		setExcludingId(item.id);
		try {
			await setTransactionExcluded(item.id, true);
			setDrilldown((prev) => (prev ? {
				...prev,
				items: prev.items.filter((row) => row.id !== item.id),
			} : null));
			await onRefresh?.();
		} finally {
			setExcludingId(null);
		}
	}

	if (!data?.periods?.length) {
		return (
			<div className="card p-8 text-center text-muted text-sm">
				No data for the selected date range.
			</div>
		);
	}

	return (
		<>
			<div className="card overflow-hidden">
				<ReportExportBar data={data} />

				<div className="overflow-x-auto">
					<table className="w-full min-w-[640px] text-sm">
						<thead>
							<tr className="border-b border-border bg-gray-50">
								<th className="table-head text-left w-56 min-w-[14rem] sticky left-0 bg-gray-50 z-10" />
								{data.periods.map((p) => (
									<th key={p.key} className="table-head text-right whitespace-nowrap px-2 text-xs">
										{p.label}
									</th>
								))}
								<th className="table-head text-right whitespace-nowrap px-3 font-bold">Total</th>
							</tr>
						</thead>
						<tbody>
							{data.rows.map((row) => {
								if (row.type === 'section') {
									return (
										<tr key={row.id} className={ROW_STYLES.section}>
											<td colSpan={data.periods.length + 2} className="px-3 py-1.5 border-t border-border">
												{row.label}
											</td>
										</tr>
									);
								}
								if (row.type === 'subsection') {
									return (
										<tr key={row.id} className={ROW_STYLES.subsection}>
											<td colSpan={data.periods.length + 2} className={clsx('px-3 py-1', indentClass(1))}>
												{row.label}
											</td>
										</tr>
									);
								}

								const style = ROW_STYLES[row.style] || ROW_STYLES.line;
								const values = row.values || {};

								return (
									<tr key={row.id} className={style}>
										<td className={clsx(
											'px-3 py-1 sticky left-0 z-10 border-r border-border/50',
											style,
											indentClass(row.indent || 0),
										)}
										>
											{row.label}
										</td>
										{data.periods.map((p) => (
											<td key={p.key} className="px-3 py-1 text-right tabular-nums whitespace-nowrap">
												<AmountButton
													value={values[p.key]}
													onClick={() => openDrilldown(row, p.key)}
												/>
											</td>
										))}
										<td className="px-3 py-1 text-right tabular-nums whitespace-nowrap">
											<AmountButton
												value={values.total}
												onClick={() => openDrilldown(row, 'total')}
											/>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			<ReportDrilldownPanel
				title={drilldown?.title}
				subtitle={drilldown?.subtitle}
				items={drilldownItems}
				properties={properties}
				onClose={() => setDrilldown(null)}
				onItemUpdated={handleItemSaved}
				onExcludeItem={excludeItem}
				excludingId={excludingId}
			/>
		</>
	);
}
