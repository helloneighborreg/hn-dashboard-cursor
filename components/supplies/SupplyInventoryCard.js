import Image from 'next/image';
import { MapPin, Package } from 'lucide-react';
import Badge from '../Badge';

export default function SupplyInventoryCard({ item }) {
	const product = item.product;
	return (
		<div className="card overflow-hidden">
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
			</div>
			<div className="p-4">
				<h3 className="font-semibold text-dark text-sm leading-snug mb-2">{product?.title || 'Unknown'}</h3>
				<p className="flex items-center gap-1.5 text-xs text-muted">
					<MapPin size={12} className="flex-shrink-0" />
					{item.location}
				</p>
			</div>
		</div>
	);
}
