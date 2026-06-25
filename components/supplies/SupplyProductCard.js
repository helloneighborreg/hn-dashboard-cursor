import { useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { Plus, Pencil, Package, Trash2 } from 'lucide-react';
import { fmtSupplyPrice } from '../../lib/supplies';
import SupplyAddQuantityModal from './SupplyAddQuantityModal';

export default function SupplyProductCard({ product, onAdd, onEdit, onDelete, disabled }) {
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [showQtyModal, setShowQtyModal] = useState(false);

	async function handleDelete() {
		if (!onDelete) return;
		setDeleting(true);
		try {
			await onDelete(product);
			setConfirmDelete(false);
		} catch {
			// parent surfaces errors
		} finally {
			setDeleting(false);
		}
	}

	return (
		<div className="card overflow-hidden flex flex-col group relative">
			{confirmDelete && (
				<div className="absolute inset-0 z-20 bg-white/95 flex flex-col items-center justify-center p-3">
					<p className="text-xs text-center text-amber-800 mb-2">
						Delete this product? Inventory for this item will also be removed.
					</p>
					<div className="flex gap-1.5 w-full">
						<button
							type="button"
							onClick={() => setConfirmDelete(false)}
							disabled={deleting}
							className="btn-secondary flex-1 text-xs py-1.5"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleDelete}
							disabled={deleting}
							className={clsx('btn-danger flex-1 text-xs py-1.5', deleting && 'opacity-60')}
						>
							{deleting ? 'Deleting…' : 'Delete'}
						</button>
					</div>
				</div>
			)}
			<div className="relative bg-brand-50 aspect-[4/3] flex items-center justify-center p-2">
				{product.image_url ? (
					<div className="relative w-full h-full">
						<Image
							src={product.image_url}
							alt={product.title}
							fill
							sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
							className="object-contain"
						/>
					</div>
				) : (
					<div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-brand-300">
						<Package size={20} strokeWidth={1.25} />
					</div>
				)}
				{(onEdit || onDelete) && (
					<div className="absolute top-1.5 right-1.5 flex gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
						{onDelete && (
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="p-1 rounded-full bg-white/90 text-red-600 shadow-sm hover:bg-white"
								aria-label={`Delete ${product.title}`}
							>
								<Trash2 size={12} />
							</button>
						)}
						{onEdit && (
							<button
								type="button"
								onClick={() => onEdit(product)}
								className="p-1 rounded-full bg-white/90 text-brand-600 shadow-sm hover:bg-white"
								aria-label={`Edit ${product.title}`}
							>
								<Pencil size={12} />
							</button>
						)}
					</div>
				)}
			</div>

			<div className="p-2 flex flex-col flex-1">
				<h3 className="font-medium text-dark text-xs leading-snug mb-0.5 line-clamp-2">{product.title || 'Unknown'}</h3>
				<p className="text-brand-600 font-semibold text-xs mb-2">{fmtSupplyPrice(product.sale_price)}</p>

				{disabled ? (
					<div className="mt-auto flex items-center justify-center text-muted text-xs py-1">
						Order in progress
					</div>
				) : (
					<button
						type="button"
						onClick={() => setShowQtyModal(true)}
						className="mt-auto self-start btn-primary text-[10px] gap-0.5 py-1 px-2"
					>
						<Plus size={12} />
						Add
					</button>
				)}
			</div>

			{showQtyModal && (
				<SupplyAddQuantityModal
					product={product}
					onClose={() => setShowQtyModal(false)}
					onConfirm={(quantity) => {
						onAdd?.(product, quantity);
						setShowQtyModal(false);
					}}
				/>
			)}
		</div>
	);
}
