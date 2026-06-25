import { useState } from 'react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { useFocusTrap } from '../../lib/useFocusTrap';
import { fetchJson } from '../../lib/apiClient';
import { getLocationLeafName, INVENTORY_ONLY_CATEGORY } from '../../lib/supplies';
import SupplyImageUploadField from './SupplyImageUploadField';

const CUSTOM_PRODUCT_VALUE = '__custom__';

export default function SupplyInventoryItemModal({
	item,
	location,
	products = [],
	existingProductIds = [],
	onClose,
	onSaved,
	onDeleted,
}) {
	const isEdit = Boolean(item?.id);
	const product = item?.product;
	const isInventoryOnly = product?.category === INVENTORY_ONLY_CATEGORY;
	const [productId, setProductId] = useState(item?.product_id || '');
	const [customTitle, setCustomTitle] = useState('');
	const [title, setTitle] = useState(product?.title || '');
	const [imageUrl, setImageUrl] = useState(product?.image_url || '');
	const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [err, setErr] = useState('');
	useEscapeKey(onClose);
	const dialogRef = useFocusTrap();

	const availableProducts = isEdit
		? products
		: products.filter((p) => !existingProductIds.includes(p.id));
	const isCustomProduct = productId === CUSTOM_PRODUCT_VALUE;
	const canEditTitle = isEdit ? isInventoryOnly : isCustomProduct;
	const uploadProductId = isEdit ? product?.id : (isCustomProduct ? null : productId || null);

	function changeQty(next) {
		const n = Math.max(0, Math.floor(Number(next)) || 0);
		setQuantity(String(n));
	}

	async function submit(e) {
		e.preventDefault();
		setErr('');
		if (!isEdit && !productId) {
			setErr('Select a product or choose custom item');
			return;
		}
		if (!isEdit && isCustomProduct && !customTitle.trim()) {
			setErr('Enter a name for the custom item');
			return;
		}
		if (isEdit && canEditTitle && !title.trim()) {
			setErr('Item name is required');
			return;
		}
		const qty = Math.max(0, parseInt(quantity, 10) || 0);
		setSaving(true);
		try {
			if (isEdit) {
				const body = { quantity: qty };
				if (canEditTitle) body.title = title.trim();
				if (imageUrl !== (product?.image_url || '')) {
					body.image_url = imageUrl.trim() || null;
				}
				await fetchJson(`/api/supplies/inventory/${item.id}`, {
					method: 'PATCH',
					body,
				});
			} else {
				const body = {
					location: location?.trim(),
					quantity: qty,
				};
				if (isCustomProduct) {
					body.title = customTitle.trim();
					if (imageUrl.trim()) body.image_url = imageUrl.trim();
				} else {
					body.product_id = productId;
				}
				await fetchJson('/api/supplies/inventory', {
					method: 'POST',
					body,
				});
			}
			onSaved?.();
			onClose();
		} catch (saveErr) {
			setErr(saveErr.message);
		} finally {
			setSaving(false);
		}
	}

	async function remove() {
		if (!isEdit) return;
		setErr('');
		setDeleting(true);
		try {
			await fetchJson(`/api/supplies/inventory/${item.id}`, { method: 'DELETE' });
			onDeleted?.(item.id);
			onClose();
		} catch (deleteErr) {
			setErr(deleteErr.message);
		} finally {
			setDeleting(false);
			setConfirmDelete(false);
		}
	}

	const modalTitle = isEdit
		? product?.title || 'Edit item'
		: `Add item to ${getLocationLeafName(location)}`;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
			<div
				ref={dialogRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={modalTitle}
				className="bg-white rounded-2xl shadow-2xl w-full max-w-md focus:outline-none max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white z-10">
					<h2 className="font-semibold text-dark text-sm pr-4">{modalTitle}</h2>
					<button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-dark">
						<X size={18} />
					</button>
				</div>
				<form onSubmit={submit} className="p-5 space-y-4">
					{(isEdit || isCustomProduct) && (
						<SupplyImageUploadField
							label={isEdit ? 'Item image' : 'Item image'}
							imageUrl={imageUrl}
							onImageUrlChange={setImageUrl}
							productId={uploadProductId}
							uploading={uploading}
							onUploadingChange={setUploading}
							onError={setErr}
						/>
					)}
					{isEdit && !isInventoryOnly && (
						<p className="text-xs text-muted -mt-2">
							Image updates apply to this product everywhere it appears in inventory.
						</p>
					)}
					{!isEdit && (
						<div className="space-y-3">
							<div>
								<label className="label" htmlFor="inventory-product">Product</label>
								<select
									id="inventory-product"
									className="input"
									value={productId}
									onChange={(e) => setProductId(e.target.value)}
									required
								>
									<option value="">Select a product…</option>
									{availableProducts.map((p) => (
										<option key={p.id} value={p.id}>{p.title}</option>
									))}
									<option value={CUSTOM_PRODUCT_VALUE}>Custom item…</option>
								</select>
								{availableProducts.length === 0 && !isCustomProduct && (
									<p className="text-xs text-muted mt-1.5">
										All catalog products are already at this location. Choose custom item for one-off stock.
									</p>
								)}
							</div>
							{isCustomProduct && (
								<div>
									<label className="label" htmlFor="inventory-custom-title">Custom item name *</label>
									<input
										id="inventory-custom-title"
										type="text"
										className="input"
										value={customTitle}
										onChange={(e) => setCustomTitle(e.target.value)}
										placeholder="e.g. Spare key box, Guest welcome basket"
										autoFocus
									/>
									<p className="text-xs text-muted mt-1.5">
										For one-off items that are not standard re-stock products.
									</p>
								</div>
							)}
						</div>
					)}
					{isEdit && canEditTitle && (
						<div>
							<label className="label" htmlFor="inventory-title">Item name</label>
							<input
								id="inventory-title"
								type="text"
								className="input"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								required
							/>
						</div>
					)}
					<div>
						<label className="label" htmlFor="inventory-qty">Quantity</label>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => changeQty(Number(quantity) - 1)}
								className="p-1.5 rounded-md border border-border text-muted hover:text-dark"
								aria-label="Decrease quantity"
							>
								<Minus size={14} />
							</button>
							<input
								id="inventory-qty"
								type="number"
								min={0}
								step={1}
								value={quantity}
								onChange={(e) => changeQty(e.target.value)}
								className="input w-20 text-center tabular-nums"
							/>
							<button
								type="button"
								onClick={() => changeQty(Number(quantity) + 1)}
								className="p-1.5 rounded-md border border-border text-muted hover:text-dark"
								aria-label="Increase quantity"
							>
								<Plus size={14} />
							</button>
						</div>
					</div>
					{err && <p className="text-sm text-red-600">{err}</p>}
					<div className="flex gap-2 pt-1">
						<button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
						<button
							type="submit"
							disabled={saving || uploading || (!isEdit && !productId)}
							className="btn-primary flex-1"
						>
							{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
						</button>
					</div>
					{isEdit && (
						<div className="pt-2 border-t border-border">
							{confirmDelete ? (
								<div className="space-y-2">
									<p className="text-sm text-amber-800">
										Remove this item from inventory at {item.location}?
									</p>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => setConfirmDelete(false)}
											disabled={deleting}
											className="btn-secondary flex-1"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={remove}
											disabled={deleting}
											className={clsx('btn-danger flex-1', deleting && 'opacity-60')}
										>
											{deleting ? 'Removing…' : 'Remove'}
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setConfirmDelete(true)}
									className="btn-secondary w-full text-sm gap-2 inline-flex items-center justify-center text-red-600 hover:text-red-700 hover:bg-red-50"
								>
									<Trash2 size={16} />
									Remove from inventory
								</button>
							)}
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
