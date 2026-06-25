import { useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { fmtSupplyPrice, lineTotal } from '../../lib/supplies';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

export default function SupplyAddQuantityModal({ product, onClose, onConfirm }) {
	const [quantity, setQuantity] = useState(1);
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	function changeQty(next) {
		const n = Math.max(1, Math.floor(Number(next)) || 1);
		setQuantity(n);
	}

	function handleSubmit(e) {
		e.preventDefault();
		onConfirm?.(quantity);
	}

	const unitPrice = product.sale_price;
	const total = lineTotal(unitPrice, product.sales_tax_percent, quantity);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={`Add ${product.title} to cart`}
				className="bg-white rounded-2xl shadow-2xl w-full max-w-sm focus:outline-none"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-4 border-b border-border">
					<h2 className="font-semibold text-dark text-sm pr-4 line-clamp-2">{product.title}</h2>
					<button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark flex-shrink-0">
						<X size={18} />
					</button>
				</div>
				<form onSubmit={handleSubmit} className="p-4 space-y-4">
					<p className="text-xs text-muted">
						{fmtSupplyPrice(unitPrice)} each
					</p>
					<div>
						<label className="label" htmlFor="supply-add-qty">Quantity</label>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => changeQty(quantity - 1)}
								className="p-1.5 rounded-md border border-border text-muted hover:text-dark"
								aria-label="Decrease quantity"
							>
								<Minus size={14} />
							</button>
							<input
								id="supply-add-qty"
								type="number"
								min={1}
								step={1}
								value={quantity}
								onChange={(e) => changeQty(e.target.value)}
								className="input-compact w-16 text-center tabular-nums"
							/>
							<button
								type="button"
								onClick={() => changeQty(quantity + 1)}
								className="p-1.5 rounded-md border border-border text-muted hover:text-dark"
								aria-label="Increase quantity"
							>
								<Plus size={14} />
							</button>
						</div>
					</div>
					<p className="text-sm font-medium text-dark">
						Total: <span className="tabular-nums">{fmtSupplyPrice(total)}</span>
					</p>
					<div className="flex gap-2 pt-1">
						<button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs">
							Cancel
						</button>
						<button type="submit" className="btn-primary flex-1 text-xs">
							Add to Cart
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
