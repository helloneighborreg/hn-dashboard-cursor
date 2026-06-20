import { useState } from 'react';
import IncomeStatementTable from './IncomeStatementTable';
import ReportExportBar from './ReportExportBar';
import ReportDrilldownPanel from './ReportDrilldownPanel';
import { fmtReport$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import {
	filterOwnerStatementReservations,
	filterScheduleEDrilldown,
	ownerStatementFieldAmount,
} from '../../lib/reportDrilldown';
import { canExcludeTransaction, setTransactionExcluded } from '../../lib/bookkeepingClient';

function SummaryGrid({ items, onAmountClick }) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
			{items.map(({ label, value, tone, raw, field }) => (
				<div key={label} className="card p-4">
					<p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
					{raw ? (
						<p className="text-xl font-bold mt-1 text-dark">{value}</p>
					) : (
						<button
							type="button"
							onClick={() => onAmountClick?.({ field, label })}
							className={`text-xl font-bold mt-1 text-left hover:underline ${tone === 'positive' ? 'text-green-600' : tone === 'negative' ? 'text-red-600' : 'text-brand-600'}`}
							disabled={!value}
						>
							{fmtReport$(value)}
						</button>
					)}
				</div>
			))}
		</div>
	);
}

function ClickableAmount({ value, onClick }) {
	const n = Number(value) || 0;
	if (!n) return <span className="text-muted">{fmtReport$(0)}</span>;
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-brand-600 hover:text-brand-700 hover:underline tabular-nums font-medium"
		>
			{fmtReport$(n)}
		</button>
	);
}

function OwnerStatementsView({ data }) {
	const [drilldown, setDrilldown] = useState(null);

	function openField(field, label, reservationId) {
		const rows = filterOwnerStatementReservations(data.reservations, { field, reservationId })
			.map((row) => ({
				...row,
				displayAmount: ownerStatementFieldAmount(row, field),
			}));
		setDrilldown({
			title: label,
			subtitle: reservationId ? rows[0]?.guest_name || rows[0]?.code : data.subtitle,
			items: rows,
			variant: 'reservations',
		});
	}

	return (
		<>
			<div className="card overflow-hidden">
				<ReportExportBar data={data} />
				<div className="p-5 pt-4">
					<SummaryGrid
						items={[
							{ label: 'Reservations', value: data.summary.reservation_count, raw: true },
							{ label: 'Total revenue', value: data.summary.total_revenue, tone: 'positive', field: 'revenue' },
							{ label: 'Paid to manager', value: data.summary.total_paid_to_manager, field: 'total_paid_to_manager' },
							{ label: 'Remaining balance', value: data.summary.remaining_balance_due, field: 'remaining_balance_due' },
						]}
						onAmountClick={({ field, label }) => openField(field, label)}
					/>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border">
									<th className="table-head">Property</th>
									<th className="table-head">Guest</th>
									<th className="table-head">Check-in</th>
									<th className="table-head">Check-out</th>
									<th className="table-head text-right">Revenue</th>
									<th className="table-head text-right">Paid to manager</th>
									<th className="table-head text-right">Remaining due</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.reservations.map((row) => (
									<tr key={row.id} className="hover:bg-gray-50">
										<td className="table-cell">{row.property_name}</td>
										<td className="table-cell">{row.guest_name || row.code}</td>
										<td className="table-cell">{formatDateOrDash(row.check_in)}</td>
										<td className="table-cell">{formatDateOrDash(row.check_out)}</td>
										<td className="table-cell text-right">
											<ClickableAmount value={row.revenue} onClick={() => openField('revenue', 'Revenue', row.id)} />
										</td>
										<td className="table-cell text-right">
											<ClickableAmount value={row.total_paid_to_manager} onClick={() => openField('total_paid_to_manager', 'Paid to manager', row.id)} />
										</td>
										<td className="table-cell text-right">
											<ClickableAmount value={row.remaining_balance_due} onClick={() => openField('remaining_balance_due', 'Remaining due', row.id)} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<ReportDrilldownPanel
				title={drilldown?.title}
				subtitle={drilldown?.subtitle}
				items={drilldown?.items}
				variant={drilldown?.variant}
				onClose={() => setDrilldown(null)}
			/>
		</>
	);
}

function BalanceSheetView({ data }) {
	return (
		<div className="card overflow-hidden">
			<ReportExportBar data={data} />
			<div className="p-5 pt-4">
				{data.note && (
					<p className="text-sm text-muted mb-4 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
						{data.note}
					</p>
				)}
				<div className="grid lg:grid-cols-3 gap-4">
					{[
						{ title: 'Assets', rows: data.assets, total: data.totals.assets },
						{ title: 'Liabilities', rows: data.liabilities, total: data.totals.liabilities },
						{ title: 'Equity', rows: data.equity, total: data.totals.equity },
					].map((section) => (
						<div key={section.title} className="card p-5">
							<h2 className="font-semibold text-dark mb-4">{section.title}</h2>
							<ul className="space-y-2 text-sm">
								{section.rows.map((row) => (
									<li key={row.label} className="flex justify-between gap-3">
										<span className="text-muted">{row.label}</span>
										<span className="font-medium text-dark tabular-nums">{fmtReport$(row.amount)}</span>
									</li>
								))}
							</ul>
							<div className="border-t border-border mt-4 pt-3 flex justify-between font-semibold">
								<span>Total {section.title.toLowerCase()}</span>
								<span className="tabular-nums">{fmtReport$(section.total)}</span>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function ScheduleEView({ data, onRefresh }) {
	const [drilldown, setDrilldown] = useState(null);
	const [excludingId, setExcludingId] = useState(null);
	const items = data.drilldown_items || [];

	function openLine(row) {
		if (!row.amount) return;
		setDrilldown({
			title: `Schedule E — Line ${row.line}`,
			subtitle: row.label,
			items: filterScheduleEDrilldown(items, row.line),
		});
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

	return (
		<>
			<div className="card overflow-hidden">
				<ReportExportBar data={data} />
				<div className="p-5 pt-4">
					<SummaryGrid
						items={[
							{ label: 'Rental income', value: data.summary.total_income, tone: 'positive' },
							{ label: 'Expenses', value: data.summary.total_expenses, tone: 'negative' },
							{ label: 'Net rental income', value: data.summary.net_rental_income, tone: data.summary.net_rental_income >= 0 ? 'positive' : 'negative' },
						]}
					/>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border">
									<th className="table-head">Line</th>
									<th className="table-head">Category</th>
									<th className="table-head text-right">Amount</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.lines.map((row) => (
									<tr key={row.line} className="hover:bg-gray-50">
										<td className="table-cell tabular-nums">{row.line}</td>
										<td className="table-cell">{row.label}</td>
										<td className="table-cell text-right">
											<ClickableAmount value={row.amount} onClick={() => openLine(row)} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
			<ReportDrilldownPanel
				title={drilldown?.title}
				subtitle={drilldown?.subtitle}
				items={drilldown?.items}
				onClose={() => setDrilldown(null)}
				onExcludeItem={excludeItem}
				excludingId={excludingId}
			/>
		</>
	);
}

function IncomeStatementView({ data, onRefresh }) {
	return <IncomeStatementTable data={data} onRefresh={onRefresh} />;
}

export default function ReportOutput({ data, onRefresh }) {
	if (!data) return null;

	switch (data.report) {
		case 'owner-statements':
			return <OwnerStatementsView data={data} />;
		case 'net-cash-flow':
		case 'noi':
		case 'inflow-outflow':
			return <IncomeStatementView data={data} onRefresh={onRefresh} />;
		case 'balance-sheet':
			return <BalanceSheetView data={data} />;
		case 'schedule-e':
			return <ScheduleEView data={data} onRefresh={onRefresh} />;
		default:
			return null;
	}
}
