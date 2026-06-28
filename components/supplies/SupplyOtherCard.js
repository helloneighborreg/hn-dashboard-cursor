import { useState } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import SupplyOtherItemsModal from './SupplyOtherItemsModal';

export default function SupplyOtherCard({ onAdd, disabled }) {
	const [showModal, setShowModal] = useState(false);

	return (
		<div className="card overflow-hidden flex flex-col">
			<div className="relative bg-gray-50 aspect-[4/3] flex items-center justify-center p-2">
				<div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-muted">
					<MoreHorizontal size={20} strokeWidth={1.25} />
				</div>
			</div>

			<div className="p-2 flex flex-col flex-1">
				<h3 className="font-medium text-dark text-xs leading-snug mb-0.5">Other</h3>
				<p className="text-muted text-[10px] mb-2 leading-snug">Items not in the catalog</p>

				{disabled ? (
					<div className="mt-auto flex items-center justify-center text-muted text-xs py-1">
						Order in progress
					</div>
				) : (
					<button
						type="button"
						onClick={() => setShowModal(true)}
						className="mt-auto self-start btn-primary text-[10px] gap-0.5 py-1 px-2"
					>
						<Plus size={12} />
						Add
					</button>
				)}
			</div>

			{showModal && (
				<SupplyOtherItemsModal
					onClose={() => setShowModal(false)}
					onConfirm={(items) => {
						onAdd?.(items);
						setShowModal(false);
					}}
				/>
			)}
		</div>
	);
}
