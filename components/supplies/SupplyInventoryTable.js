import Image from 'next/image';
import { Box, Package, Pencil } from 'lucide-react';
import { getInventoryContainerPath } from '../../lib/supplies';

export default function SupplyInventoryTable({
	items,
	isAdmin,
	onEditItem,
	onOpenContainer,
	showLocation = false,
}) {
	if (items.length === 0) return null;

	return (
		<div className="card overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-b border-border bg-gray-50">
							<th className="table-head w-12" aria-label="Image" />
							<th className="table-head">Item</th>
							{showLocation && <th className="table-head">Location</th>}
							<th className="table-head text-right w-20">Qty</th>
							<th className="table-head w-28" />
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{items.map((item) => {
							const product = item.product;
							const containerPath = getInventoryContainerPath(item);
							return (
								<tr key={item.id} className="hover:bg-gray-50/80">
									<td className="table-cell w-12">
										<div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center overflow-hidden flex-shrink-0">
											{product?.image_url ? (
												<div className="relative w-full h-full">
													<Image
														src={product.image_url}
														alt=""
														fill
														sizes="36px"
														className="object-contain"
													/>
												</div>
											) : (
												<Package size={16} className="text-brand-300" strokeWidth={1.25} />
											)}
										</div>
									</td>
									<td className="table-cell">
										<div className="font-medium text-dark">{product?.title || 'Unknown'}</div>
										{product?.category && (
											<div className="text-xs text-muted mt-0.5">{product.category}</div>
										)}
									</td>
									{showLocation && (
										<td className="table-cell text-muted">{item.location || '—'}</td>
									)}
									<td className="table-cell text-right font-medium tabular-nums">{item.quantity}</td>
									<td className="table-cell text-right">
										<div className="flex items-center justify-end gap-1">
											{onOpenContainer && containerPath && (
												<button
													type="button"
													onClick={() => onOpenContainer(item)}
													className="btn-secondary text-xs gap-1 py-1 px-2"
												>
													<Box size={12} />
													Contents
												</button>
											)}
											{isAdmin && onEditItem && (
												<button
													type="button"
													onClick={() => onEditItem(item)}
													className="p-1.5 rounded-lg text-muted hover:text-brand-600 hover:bg-brand-50"
													aria-label={`Edit ${product?.title || 'item'}`}
												>
													<Pencil size={14} />
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
