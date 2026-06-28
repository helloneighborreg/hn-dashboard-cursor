import { useState } from 'react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';

function emptyRow() {
	return { title: '', quantity: 1 };
}

export default function SupplyOtherItemsModal({ onClose, onConfirm }) {
	const [rows, setRows] = useState([emptyRow()]);
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	function updateRow(index, patch) {
		setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	}

	function addRow() {
		setRows((prev) => [...prev, emptyRow()]);
	}

	function removeRow(index) {
		setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
	}

	function changeQty(index, next) {
		const qty = Math.max(1, Math.floor(Number(next)) || 1);
		updateRow(index, { quantity: qty });
	}

	function handleSubmit(e) {
		e.preventDefault();
		const items = rows
			.map((row) => ({
				custom_title: row.title.trim(),
				quantity: Math.max(1, Math.floor(Number(row.quantity)) || 1),
			}))
			.filter((item) => item.custom_title);
		if (!items.length) return;
		onConfirm?.(items);
	}

	const hasValidRows = rows.some((row) => row.title.trim());

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label="Add other supply items"
				className="bg-white rounded-2xl shadow-2xl w-full max-w-md focus:outline-none"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-4 border-b border-border">
					<div>
						<h2 className="font-semibold text-dark text-sm">Other items</h2>
						<p className="text-xs text-muted mt-0.5">Add supplies not listed in the catalog.</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark flex-shrink-0">
						<X size={18} />
					</button>
				</div>
				<form onSubmit={handleSubmit} className="p-4 space-y-3">
					<div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
						{rows.map((row, index) => (
							<div key={index} className="flex items-end gap-2">
								<div className="flex-1 min-w-0">
									<label className="label" htmlFor={`other-item-${index}`}>
										Item {rows.length > 1 ? index + 1 : ''}
									</label>
									<input
										id={`other-item-${index}`}
										type="text"
										value={row.title}
										onChange={(e) => updateRow(index, { title: e.target.value })}
										className="input text-sm"
										placeholder="e.g. Replacement shower head"
										autoFocus={index === 0}
									/>
								</div>
								<div className="flex-shrink-0">
									<label className="label" htmlFor={`other-qty-${index}`}>Qty</label>
									<div className="flex items-center gap-1">
										<button
											type="button"
											onClick={() => changeQty(index, row.quantity - 1)}
											className="p-1 rounded-md border border-border text-muted hover:text-dark"
											aria-label="Decrease quantity"
										>
											<Minus size={12} />
										</button>
										<input
											id={`other-qty-${index}`}
											type="number"
											min={1}
											step={1}
											value={row.quantity}
											onChange={(e) => changeQty(index, e.target.value)}
											className="input-compact w-12 text-center tabular-nums"
										/>
										<button
											type="button"
											onClick={() => changeQty(index, row.quantity + 1)}
											className="p-1 rounded-md border border-border text-muted hover:text-dark"
											aria-label="Increase quantity"
										>
											<Plus size={12} />
										</button>
									</div>
								</div>
								<button
									type="button"
									onClick={() => removeRow(index)}
									className="p-1.5 mb-0.5 text-muted hover:text-red-600"
									aria-label="Remove row"
								>
									<Trash2 size={14} />
								</button>
							</div>
						))}
					</div>
					<button type="button" onClick={addRow} className="btn-secondary text-xs w-full gap-1">
						<Plus size={12} />
						Add another item
					</button>
					<div className="flex gap-2 pt-1">
						<button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs">
							Cancel
						</button>
						<button type="submit" disabled={!hasValidRows} className="btn-primary flex-1 text-xs">
							Add to Cart
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
