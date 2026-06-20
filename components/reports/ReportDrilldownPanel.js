import { useState } from 'react';
import { X, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { fmtReport$ } from '../financials/format';
import { formatDateOrDash } from '../../lib/dates';
import { categoryLabel } from '../../lib/bookkeepingCategories';
import { canExcludeTransaction } from '../../lib/bookkeepingClient';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

function AmountCell({ amount, className }) {
	const n = Number(amount) || 0;
	return (
		<span className={clsx(
			'tabular-nums font-medium',
			n > 0 ? 'text-green-600' : n < 0 ? 'text-red-600' : 'text-dark',
			className,
		)}
		>
			{fmtReport$(n)}
		</span>
	);
}

export default function ReportDrilldownPanel({
	title,
	subtitle,
	items,
	onClose,
	variant = 'transactions',
	onExcludeItem,
	excludingId,
}) {
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap(Boolean(title));

	if (!title) return null;

	const total = (items || []).reduce((sum, item) => sum + (Number(item.displayAmount ?? item.amount) || 0), 0);

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
				onClick={onClose}
			/>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white shadow-2xl flex flex-col overflow-hidden focus:outline-none"
			>
				<div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
					<div className="min-w-0">
						<h2 className="text-lg font-bold text-dark">{title}</h2>
						{subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-2 rounded-lg text-muted hover:text-dark hover:bg-gray-100"
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto">
					{!items?.length ? (
						<p className="p-8 text-center text-sm text-muted">No transactions for this amount.</p>
					) : variant === 'reservations' ? (
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-gray-50 border-b border-border">
								<tr>
									<th className="table-head">Property</th>
									<th className="table-head">Guest</th>
									<th className="table-head">Check-in</th>
									<th className="table-head">Check-out</th>
									<th className="table-head text-right">Amount</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{items.map((row) => (
									<tr key={row.id} className="hover:bg-gray-50">
										<td className="table-cell">{row.property_name}</td>
										<td className="table-cell">{row.guest_name || row.code}</td>
										<td className="table-cell">{formatDateOrDash(row.check_in)}</td>
										<td className="table-cell">{formatDateOrDash(row.check_out)}</td>
										<td className="table-cell text-right">
											<AmountCell amount={row.displayAmount} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					) : (
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-gray-50 border-b border-border">
								<tr>
									<th className="table-head">Date</th>
									<th className="table-head">Description</th>
									<th className="table-head">Property</th>
									<th className="table-head">Category</th>
									<th className="table-head">Reservation</th>
									<th className="table-head text-right">Amount</th>
									{onExcludeItem && <th className="table-head w-24" />}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{items.map((row) => (
									<tr key={`${row.source}-${row.id}`} className="hover:bg-gray-50">
										<td className="table-cell whitespace-nowrap">{formatDateOrDash(row.date)}</td>
										<td className="table-cell max-w-[12rem] truncate" title={row.description}>{row.description}</td>
										<td className="table-cell max-w-[10rem] truncate">{row.property_name || '—'}</td>
										<td className="table-cell max-w-[10rem] truncate">{categoryLabel(row.category) || '—'}</td>
										<td className="table-cell font-mono text-xs">{row.reservation_code || '—'}</td>
										<td className="table-cell text-right">
											<AmountCell amount={row.displayAmount ?? row.reportAmount ?? row.amount} />
										</td>
										{onExcludeItem && (
											<td className="table-cell text-right">
												{canExcludeTransaction(row) && (
													<button
														type="button"
														onClick={() => onExcludeItem(row)}
														disabled={excludingId === row.id}
														className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-dark disabled:opacity-50"
														title="Exclude from reports"
													>
														<EyeOff size={14} />
														Exclude
													</button>
												)}
											</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>

				{items?.length > 0 && (
					<div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between bg-gray-50">
						<p className="text-sm text-muted">
							{items.length} {variant === 'reservations' ? 'reservation' : 'transaction'}{items.length === 1 ? '' : 's'}
						</p>
						<p className="text-sm font-bold text-dark">
							Total: <AmountCell amount={total} className="inline" />
						</p>
					</div>
				)}
			</div>
		</>
	);
}
