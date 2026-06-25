import { MapPin, Plus, Pencil } from 'lucide-react';
import SupplyInventoryCard from './SupplyInventoryCard';

export default function SupplyInventoryLocationSection({
	node,
	itemsByLocation,
	emptyLocations,
	isAdmin,
	search,
	onEditLocation,
	onAddSubLocation,
	onAddItem,
	onEditItem,
	onOpenContainer,
}) {
	const locationItems = itemsByLocation[node.path] || [];
	const hasDirectItems = locationItems.length > 0;
	const isEmptyTracked = emptyLocations.includes(node.path);
	const hasVisibleChild = node.children.some((child) => childHasVisibleContent(
		child,
		itemsByLocation,
		emptyLocations,
		search,
	));
	const showSection = hasDirectItems || isEmptyTracked || hasVisibleChild
		|| (!search.trim() && node.depth === 0);

	if (!showSection) return null;

	return (
		<section className={node.depth > 0 ? 'mt-6' : ''}>
			<div
				className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between"
				style={{ paddingLeft: node.depth > 0 ? `${node.depth * 1.25}rem` : undefined }}
			>
				<div className="flex items-center gap-2 min-w-0">
					<MapPin size={node.depth === 0 ? 18 : 16} className="text-brand-500 flex-shrink-0" />
					<h2 className={`font-semibold text-dark truncate ${node.depth === 0 ? 'text-lg' : 'text-base'}`}>
						{node.name}
					</h2>
					{locationItems.length > 0 && (
						<span className="text-xs text-muted flex-shrink-0">
							{locationItems.length} item{locationItems.length === 1 ? '' : 's'}
						</span>
					)}
				</div>
				{isAdmin && (
					<div className="flex flex-wrap gap-2" style={{ marginLeft: node.depth > 0 ? `${node.depth * 1.25}rem` : undefined }}>
						<button
							type="button"
							onClick={() => onEditLocation(node.path)}
							className="btn-secondary text-xs gap-1.5"
						>
							<Pencil size={12} />
							Edit
						</button>
						<button
							type="button"
							onClick={() => onAddSubLocation(node.path)}
							className="btn-secondary text-xs gap-1.5"
						>
							<Plus size={12} />
							Add Sub-location
						</button>
						<button
							type="button"
							onClick={() => onAddItem(node.path)}
							className="btn-primary text-xs gap-1.5"
						>
							<Plus size={12} />
							Add Item
						</button>
					</div>
				)}
			</div>
			<div style={{ paddingLeft: node.depth > 0 ? `${node.depth * 1.25}rem` : undefined }}>
				{locationItems.length === 0 && (isEmptyTracked || node.children.length === 0) ? (
					<div className="card p-6 text-center text-sm text-muted">
						No items at this location yet.
						{isAdmin && (
							<button
								type="button"
								onClick={() => onAddItem(node.path)}
								className="block mx-auto mt-2 text-brand-600 hover:text-brand-700 font-medium"
							>
								Add the first item
							</button>
						)}
					</div>
				) : locationItems.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{locationItems.map((item) => (
							<SupplyInventoryCard
								key={item.id}
								item={item}
								onEdit={isAdmin ? onEditItem : undefined}
								onOpenContainer={onOpenContainer}
							/>
						))}
					</div>
				) : null}
			</div>
			{node.children.map((child) => (
				<SupplyInventoryLocationSection
					key={child.path}
					node={child}
					itemsByLocation={itemsByLocation}
					emptyLocations={emptyLocations}
					isAdmin={isAdmin}
					search={search}
					onEditLocation={onEditLocation}
					onAddSubLocation={onAddSubLocation}
					onAddItem={onAddItem}
					onEditItem={onEditItem}
					onOpenContainer={onOpenContainer}
				/>
			))}
		</section>
	);
}

function childHasVisibleContent(node, itemsByLocation, emptyLocations, search) {
	const hasDirectItems = (itemsByLocation[node.path] || []).length > 0;
	const isEmptyTracked = emptyLocations.includes(node.path);
	if (hasDirectItems || isEmptyTracked) return true;
	return node.children.some((child) => childHasVisibleContent(child, itemsByLocation, emptyLocations, search));
}

export function filterLocationTree(nodes, locationFilter) {
	if (!locationFilter) return nodes;
	for (const node of nodes) {
		if (node.path === locationFilter) return [node];
		const match = filterLocationTree(node.children, locationFilter);
		if (match.length > 0) return match;
	}
	return [];
}

export function locationTreeHasVisibleNodes(nodes, itemsByLocation, emptyLocations, search) {
	return nodes.some((node) => {
		const hasDirectItems = (itemsByLocation[node.path] || []).length > 0;
		const isEmptyTracked = emptyLocations.includes(node.path);
		const hasVisibleChild = locationTreeHasVisibleNodes(node.children, itemsByLocation, emptyLocations, search);
		return hasDirectItems || isEmptyTracked || hasVisibleChild;
	});
}
