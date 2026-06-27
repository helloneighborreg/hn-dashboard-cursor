import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { registerServiceWorker } from '../lib/pwa';

export default function PwaUpdateToast() {
	const [activateUpdate, setActivateUpdate] = useState(null);

	useEffect(() => {
		registerServiceWorker({
			onUpdateAvailable:
				process.env.NODE_ENV === 'production'
					? (activate) => setActivateUpdate(() => activate)
					: undefined,
		});
	}, []);

	if (!activateUpdate) return null;

	return (
		<div
			className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-lg"
			role="status"
			aria-live="polite"
		>
			<RefreshCw size={18} className="shrink-0 text-brand-600" />
			<p className="flex-1 text-sm text-dark">A new version is available.</p>
			<button
				type="button"
				onClick={() => activateUpdate()}
				className="btn-primary shrink-0 px-3 py-1.5 text-xs"
			>
				Reload
			</button>
			<button
				type="button"
				onClick={() => setActivateUpdate(null)}
				className="shrink-0 rounded-lg p-1 text-muted hover:bg-gray-100 hover:text-dark"
				aria-label="Dismiss update notice"
			>
				<X size={16} />
			</button>
		</div>
	);
}
