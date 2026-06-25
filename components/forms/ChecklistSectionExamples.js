export default function ChecklistSectionExamples({ photos = [] }) {
	if (!photos.length) return null;

	return (
		<div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/60 p-3 mb-3">
			<p className="text-xs font-medium text-brand-800 mb-2">
				Example photo{photos.length > 1 ? 's' : ''}
			</p>
			<div className="flex flex-wrap gap-2">
				{photos.map((photo) => (
					<a
						key={photo.id}
						href={photo.url}
						target="_blank"
						rel="noopener noreferrer"
						className="block shrink-0"
					>
						<img
							src={photo.url}
							alt={photo.filename || 'Example photo'}
							className="h-24 w-24 sm:h-28 sm:w-28 object-cover rounded-md border border-border bg-white"
						/>
					</a>
				))}
			</div>
		</div>
	);
}
