import { X, Minus, Plus, ShoppingCart, PackageCheck } from 'lucide-react';
import { fmtSupplyPrice, lineTotal, orderTotal, SUPPLY_ORDER_STATUS } from '../../lib/supplies';
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

function CartLine({ item, product, readOnly, onQtyChange, onRemove }) {
	const title = product?.title || 'Unknown';
	return (
		<div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-dark truncate">{title}</p>
				<p className="text-xs text-muted mt-0.5">
					{fmtSupplyPrice(item.unit_price)} each
					{item.sales_tax_percent > 0 && ` · incl. ${item.sales_tax_percent}% tax`}
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
				{fmtSupplyPrice(lineTotal(item.unit_price, item.sales_tax_percent, item.quantity))}
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
	submitting,
	delivering,
}) {
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();
	const total = orderTotal(items);
	const isEmpty = !items.length;
	const readOnly = activeOrder?.status === SUPPLY_ORDER_STATUS.SUBMITTED;
	const isInvoice = readOnly;

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
							<p className="text-amber-800 text-xs mt-0.5">
								Deliver to <span className="font-medium">{location || 'Warehouse'}</span>
							</p>
						</div>
					)}
					{isEmpty ? (
						<p className="text-sm text-muted text-center py-12">
							{isInvoice ? 'This order has no items.' : 'Your cart is empty. Add products from the store.'}
						</p>
					) : (
						<>
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
											placeholder="Warehouse"
										/>
										<datalist id="supply-locations">
											{(locations || []).map((loc) => (
												<option key={loc} value={loc} />
											))}
										</datalist>
									</>
								)}
							</div>
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
						<button
							type="button"
							onClick={onDeliver}
							disabled={delivering}
							className="btn-primary w-full py-2.5"
						>
							{delivering ? 'Marking delivered…' : 'Mark Delivered & Add to Inventory'}
						</button>
					) : (
						<button
							type="button"
							onClick={onSubmit}
							disabled={isEmpty || submitting}
							className="btn-primary w-full py-2.5"
						>
							{submitting ? 'Submitting…' : 'Submit Order'}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
