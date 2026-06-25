import Image from 'next/image';
import { MapPin, Package, Pencil, Box } from 'lucide-react';
import Badge from '../Badge';
import { getLocationLeafName, getInventoryContainerPath } from '../../lib/supplies';

export default function SupplyInventoryCard({ item, onEdit, onOpenContainer }) {
	const product = item.product;
	const containerPath = getInventoryContainerPath(item);

	return (
		<div className="card overflow-hidden group relative">
			<div className="relative bg-brand-50 aspect-[4/3] flex items-center justify-center p-4">
				{product?.image_url ? (
					<div className="relative w-full h-full">
						<Image
							src={product.image_url}
							alt={product.title}
							fill
							sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
							className="object-contain"
						/>
					</div>
				) : (
					<div className="w-20 h-20 rounded-xl bg-white/80 flex items-center justify-center text-brand-300">
						<Package size={36} strokeWidth={1.25} />
					</div>
				)}
				<div className="absolute top-3 right-3">
					<Badge label={`Qty ${item.quantity}`} variant="accepted" />
				</div>
				{onEdit && (
					<button
						type="button"
						onClick={() => onEdit(item)}
						className="absolute top-3 left-3 p-1.5 rounded-full bg-white/90 text-brand-600 shadow-sm hover:bg-white opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
						aria-label={`Edit ${product?.title || 'item'}`}
					>
						<Pencil size={14} />
					</button>
				)}
			</div>
			<div className="p-4">
				<h3 className="font-semibold text-dark text-sm leading-snug mb-2">{product?.title || 'Unknown'}</h3>
				<p className="flex items-center gap-1.5 text-xs text-muted mb-3">
					<MapPin size={12} className="flex-shrink-0" />
					{getLocationLeafName(item.location)}
				</p>
				{onOpenContainer && containerPath && (
					<button
						type="button"
						onClick={() => onOpenContainer(item)}
						className="btn-secondary w-full text-xs gap-1.5 inline-flex items-center justify-center"
					>
						<Box size={14} />
						Open contents
					</button>
				)}
			</div>
		</div>
	);
}
