import { FileText, Pencil, PackageCheck, CircleCheckBig, RotateCcw } from 'lucide-react';
import { fmtSupplyPrice, SUPPLY_ORDER_STATUS, supplyInvoicePdfUrl } from '../../lib/supplies';
import { formatDateOrDash } from '../../lib/dates';

function statusLabel(order) {
	if (order.status === SUPPLY_ORDER_STATUS.DRAFT) return 'Draft';
	if (order.status === SUPPLY_ORDER_STATUS.SUBMITTED) return 'Invoice';
	return order.status;
}

function statusVariant(order) {
	if (order.status === SUPPLY_ORDER_STATUS.DRAFT) return 'bg-gray-100 text-gray-700';
	return 'bg-amber-100 text-amber-800';
}

export default function SupplyOutstandingOrders({
	orders,
	onEdit,
	onViewInvoice,
	onReopen,
	onMarkPaid,
	onDeliver,
	payingId,
	deliveringId,
	reopeningId,
}) {
	if (!orders.length) {
		return (
			<div className="card p-8 text-center">
				<p className="text-sm text-muted">No outstanding supply orders.</p>
				<p className="text-xs text-muted mt-1">Draft and submitted invoices appear here until delivered.</p>
			</div>
		);
	}

	return (
		<div className="card overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-bg text-left text-xs text-muted">
							<th className="px-4 py-3 font-medium">Property</th>
							<th className="px-4 py-3 font-medium">Status</th>
							<th className="px-4 py-3 font-medium text-right">Total</th>
							<th className="px-4 py-3 font-medium">Paid</th>
							<th className="px-4 py-3 font-medium">Updated</th>
							<th className="px-4 py-3 font-medium text-right">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{orders.map((order) => {
							const isDraft = order.status === SUPPLY_ORDER_STATUS.DRAFT;
							const isSubmitted = order.status === SUPPLY_ORDER_STATUS.SUBMITTED;
							const isPaid = Boolean(order.paid_at);
							const busy = payingId === order.id || deliveringId === order.id || reopeningId === order.id;

							return (
								<tr key={order.id} className="hover:bg-gray-50/80">
									<td className="px-4 py-3">
										<p className="font-medium text-dark">{order.property_name || 'No property'}</p>
										{order.location && (
											<p className="text-xs text-muted mt-0.5">Deliver to {order.location}</p>
										)}
									</td>
									<td className="px-4 py-3">
										<span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${statusVariant(order)}`}>
											{statusLabel(order)}
										</span>
									</td>
									<td className="px-4 py-3 text-right tabular-nums font-medium text-dark">
										{fmtSupplyPrice(order.total_amount)}
									</td>
									<td className="px-4 py-3">
										{isPaid ? (
											<span className="inline-flex items-center gap-1 text-xs text-green-700">
												<CircleCheckBig size={14} />
												{formatDateOrDash(order.paid_at)}
											</span>
										) : (
											<span className="text-xs text-muted">—</span>
										)}
									</td>
									<td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
										{formatDateOrDash(order.submitted_at || order.created_at)}
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center justify-end gap-1.5 flex-wrap">
											{isDraft && (
												<button
													type="button"
													onClick={() => onEdit(order)}
													className="btn-secondary text-xs gap-1 py-1 px-2"
													disabled={busy}
												>
													<Pencil size={12} />
													Edit
												</button>
											)}
											{isSubmitted && !isPaid && (
												<button
													type="button"
													onClick={() => onReopen(order)}
													className="btn-secondary text-xs gap-1 py-1 px-2"
													disabled={busy}
													title="Reopen to add more items"
												>
													<RotateCcw size={12} />
													{reopeningId === order.id ? 'Reopening…' : 'Edit'}
												</button>
											)}
											{(isSubmitted || isDraft) && order.property_id && (
												<button
													type="button"
													onClick={() => onViewInvoice(order)}
													className="btn-secondary text-xs gap-1 py-1 px-2"
													disabled={busy || isDraft}
													title={isDraft ? 'Submit invoice from the order editor' : 'View invoice PDF'}
												>
													<FileText size={12} />
													Invoice
												</button>
											)}
											{isSubmitted && !isPaid && (
												<button
													type="button"
													onClick={() => onMarkPaid(order)}
													className="btn-secondary text-xs gap-1 py-1 px-2"
													disabled={busy}
												>
													<CircleCheckBig size={12} />
													{payingId === order.id ? 'Saving…' : 'Mark paid'}
												</button>
											)}
											{isSubmitted && (
												<button
													type="button"
													onClick={() => onDeliver(order)}
													className="btn-primary text-xs gap-1 py-1 px-2"
													disabled={busy}
												>
													<PackageCheck size={12} />
													{deliveringId === order.id ? 'Delivering…' : 'Deliver'}
												</button>
											)}
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export function openSupplyInvoice(orderId) {
	if (!orderId) return;
	window.open(supplyInvoicePdfUrl(orderId), '_blank', 'noopener,noreferrer');
}
