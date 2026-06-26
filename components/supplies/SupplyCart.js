import { X, Minus, Plus, ShoppingCart, PackageCheck, FileText, CircleCheckBig } from 'lucide-react';
import { fmtSupplyPrice, lineTotal, orderTotal, pricedUnit, SUPPLY_ORDER_STATUS, supplyInvoicePdfUrl } from '../../lib/supplies';
import { getPropertyDisplayName } from '../../lib/codes';
import { formatDateOrDash } from '../../lib/dates';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

function formatOrderDate(iso) {
	if (!iso) return '';
	return new Date(iso).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function CartLine({ item, product, markupPercent, readOnly, onQtyChange, onRemove }) {
	const title = product?.title || 'Unknown';
	const unitPrice = pricedUnit(item.unit_price, markupPercent);
	return (
		<div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-dark truncate">{title}</p>
				<p className="text-xs text-muted mt-0.5">
					{fmtSupplyPrice(unitPrice)} each
					{item.sales_tax_percent > 0 && ' · tax included'}
				</p>
			</div>
			{readOnly ? (
				<p className="text-sm text-muted tabular-nums">× {item.quantity}</p>
			) : (
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => onQtyChange(item.product_id, item.quantity - 1)}
						className="p-1 rounded-md border border-border text-muted hover:text-dark"
						aria-label={`Decrease ${title}`}
					>
						<Minus size={14} />
					</button>
					<span className="w-8 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
					<button
						type="button"
						onClick={() => onQtyChange(item.product_id, item.quantity + 1)}
						className="p-1 rounded-md border border-border text-muted hover:text-dark"
						aria-label={`Increase ${title}`}
					>
						<Plus size={14} />
					</button>
				</div>
			)}
			<p className="text-sm font-medium text-dark w-16 text-right tabular-nums">
				{fmtSupplyPrice(lineTotal(item.unit_price, item.sales_tax_percent, item.quantity, markupPercent))}
			</p>
			{!readOnly && (
				<button
					type="button"
					onClick={() => onRemove(item.product_id)}
					className="p-1 text-muted hover:text-red-600"
					aria-label={`Remove ${title}`}
				>
					<X size={14} />
				</button>
			)}
		</div>
	);
}

export default function SupplyCart({
	open,
	items,
	productsById,
	properties,
	propertyId,
	onPropertyChange,
	markupPercent,
	onMarkupChange,
	activeOrder,
	location,
	locations,
	onLocationChange,
	notes,
	onNotesChange,
	onQtyChange,
	onRemove,
	onClose,
	onSubmit,
	onDeliver,
	onMarkPaid,
	submitting,
	delivering,
	paying,
}) {
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();
	const total = orderTotal(items, markupPercent);
	const isEmpty = !items.length;
	const readOnly = activeOrder?.status === SUPPLY_ORDER_STATUS.SUBMITTED;
	const isInvoice = readOnly;
	const isPaid = Boolean(activeOrder?.paid_at);
	const canViewInvoice = !isEmpty && Boolean(propertyId || activeOrder?.property_id);

	function openInvoicePdf() {
		const orderId = activeOrder?.id;
		if (!orderId) return;
		window.open(supplyInvoicePdfUrl(orderId), '_blank', 'noopener,noreferrer');
	}

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={isInvoice ? 'Supply order invoice' : 'Supply order cart'}
				className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full"
			>
				<div className="flex items-center justify-between p-5 border-b border-border">
					<div className="flex items-center gap-2">
						{isInvoice ? (
							<PackageCheck size={18} className="text-amber-500" />
						) : (
							<ShoppingCart size={18} className="text-brand-500" />
						)}
						<h2 className="font-semibold text-dark">{isInvoice ? 'Order Invoice' : 'Order Cart'}</h2>
						{!isEmpty && (
							<span className="text-xs bg-brand-50 text-brand-600 font-medium px-2 py-0.5 rounded-full">
								{items.reduce((n, i) => n + i.quantity, 0)} items
							</span>
						)}
					</div>
					<button type="button" onClick={onClose} aria-label="Close cart" className="text-muted hover:text-dark">
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-5">
					{isInvoice && activeOrder && (
						<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
							<p className="font-medium text-amber-900">Awaiting delivery</p>
							<p className="text-amber-800 text-xs mt-1">
								Submitted {formatOrderDate(activeOrder.submitted_at)}
								{activeOrder.created_by ? ` · ${activeOrder.created_by}` : ''}
							</p>
							{activeOrder.property_name && (
								<p className="text-amber-800 text-xs mt-0.5">
									Bill to <span className="font-medium">{activeOrder.property_name}</span>
								</p>
							)}
							<p className="text-amber-800 text-xs mt-0.5">
								Deliver to <span className="font-medium">{location || 'Warehouse'}</span>
							</p>
							{isPaid && (
								<p className="text-green-800 text-xs mt-2 inline-flex items-center gap-1">
									<CircleCheckBig size={12} />
									Paid {formatDateOrDash(activeOrder.paid_at)}
									{activeOrder.paid_by ? ` · ${activeOrder.paid_by}` : ''}
								</p>
							)}
						</div>
					)}
					{isEmpty ? (
						<p className="text-sm text-muted text-center py-12">
							{isInvoice ? 'This order has no items.' : 'Your cart is empty. Add products from the store.'}
						</p>
					) : (
						<>
							<div className="mb-4">
								<label className="label">Bill to property *</label>
								{readOnly ? (
									<p className="text-sm text-dark">{activeOrder?.property_name || '—'}</p>
								) : (
									<select
										className="select"
										value={propertyId || ''}
										onChange={(e) => onPropertyChange(e.target.value)}
										required
									>
										<option value="">Select a property…</option>
										{(properties || []).map((p) => (
											<option key={p.id} value={p.id}>
												{getPropertyDisplayName(p) || p.name}
											</option>
										))}
									</select>
								)}
							</div>
							<div className="mb-4">
								<label className="label">Delivery location</label>
								{readOnly ? (
									<p className="text-sm text-dark">{location || 'Warehouse'}</p>
								) : (
									<>
										<input
											className="input"
											list="supply-locations"
											value={location}
											onChange={(e) => onLocationChange(e.target.value)}
											placeholder="Select property or enter location"
										/>
										<datalist id="supply-locations">
											{(locations || []).map((loc) => (
												<option key={loc} value={loc} />
											))}
										</datalist>
									</>
								)}
							</div>
							{!readOnly && (
								<div className="mb-4">
									<label className="label" htmlFor="supply-markup-percent">Markup %</label>
									<input
										id="supply-markup-percent"
										type="number"
										min={0}
										step={0.1}
										className="input w-28"
										value={markupPercent}
										onChange={(e) => onMarkupChange(e.target.value)}
									/>
								</div>
							)}
							<div className="mb-4">
								<label className="label">Notes</label>
								{readOnly ? (
									<p className="text-sm text-dark whitespace-pre-wrap">{notes || '—'}</p>
								) : (
									<textarea
										className="input min-h-[72px] resize-y"
										value={notes}
										onChange={(e) => onNotesChange(e.target.value)}
										placeholder="PO number, vendor, etc."
									/>
								)}
							</div>
							{items.map((item) => (
								<CartLine
									key={item.product_id}
									item={item}
									product={productsById[item.product_id]}
									markupPercent={markupPercent}
									readOnly={readOnly}
									onQtyChange={onQtyChange}
									onRemove={onRemove}
								/>
							))}
						</>
					)}
				</div>

				<div className="p-4 sm:p-5 border-t border-border bg-bg" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
					<div className="flex items-center justify-between mb-4">
						<span className="text-sm text-muted">{isInvoice ? 'Invoice total' : 'Estimated total'}</span>
						<span className="text-lg font-bold text-dark">{fmtSupplyPrice(total)}</span>
					</div>
					{isInvoice ? (
						<div className="space-y-2">
							<button
								type="button"
								onClick={openInvoicePdf}
								className="btn-secondary w-full py-2.5 gap-2"
							>
								<FileText size={16} />
								View Invoice
							</button>
							{!isPaid && (
								<button
									type="button"
									onClick={onMarkPaid}
									disabled={paying}
									className="btn-secondary w-full py-2.5 gap-2"
								>
									<CircleCheckBig size={16} />
									{paying ? 'Recording payment…' : 'Mark Paid & Add Expense'}
								</button>
							)}
							<button
								type="button"
								onClick={onDeliver}
								disabled={delivering}
								className="btn-primary w-full py-2.5"
							>
								{delivering ? 'Marking delivered…' : 'Mark Delivered'}
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={onSubmit}
							disabled={isEmpty || submitting || !canViewInvoice}
							className="btn-primary w-full py-2.5 gap-2"
						>
							<FileText size={16} />
							{submitting ? 'Generating invoice…' : 'View Invoice'}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
