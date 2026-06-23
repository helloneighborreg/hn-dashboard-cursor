import { useRef } from 'react';
import clsx from 'clsx';
import { Camera, X } from 'lucide-react';

function readFileAsDataUrl(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

async function fileToEntry(file) {
	const dataUrl = await readFileAsDataUrl(file);
	const base64 = String(dataUrl).split(',')[1] || '';
	return {
		localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		filename: file.name,
		contentType: file.type || 'application/octet-stream',
		previewUrl: file.type?.startsWith('image/') ? dataUrl : null,
		base64,
	};
}

export default function FileUploadField({ id, label, value = [], onChange, error, required }) {
	const inputRef = useRef(null);
	const files = Array.isArray(value) ? value : [];

	async function handleFiles(fileList) {
		const picked = Array.from(fileList || []);
		if (!picked.length) return;
		const entries = await Promise.all(picked.map(fileToEntry));
		onChange([...files, ...entries]);
	}

	function removeAt(index) {
		onChange(files.filter((_, i) => i !== index));
	}

	return (
		<div>
			<label className="label" htmlFor={id}>
				{label}
				{required && <span className="text-red-500 ml-0.5">*</span>}
			</label>
			<div
				className={clsx(
					'rounded-xl border border-dashed p-4 transition-colors',
					error ? 'border-red-300 bg-red-50/40' : 'border-border bg-gray-50/60 hover:bg-gray-50',
				)}
			>
				<input
					ref={inputRef}
					id={id}
					type="file"
					accept="image/*,application/pdf"
					multiple
					capture="environment"
					className="sr-only"
					onChange={(e) => {
						handleFiles(e.target.files);
						e.target.value = '';
					}}
				/>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					className="btn-secondary w-full justify-center"
				>
					<Camera size={16} />
					Add photo{files.length ? 's' : ''}
				</button>
				{files.length > 0 && (
					<ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
						{files.map((file, index) => (
							<li key={file.localId || file.storage_path || index} className="relative group">
								{file.previewUrl ? (
									<img
										src={file.previewUrl || file.url}
										alt={file.filename || 'Upload'}
										className="w-full h-24 object-cover rounded-lg border border-border"
									/>
								) : (
									<div className="w-full h-24 rounded-lg border border-border bg-white flex items-center justify-center text-xs text-muted px-2 text-center">
										{file.filename || 'PDF'}
									</div>
								)}
								<button
									type="button"
									onClick={() => removeAt(index)}
									className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-90 hover:opacity-100"
									aria-label="Remove file"
								>
									<X size={12} />
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
			{error && <p className="text-xs text-red-600 mt-1">{error}</p>}
		</div>
	);
}
