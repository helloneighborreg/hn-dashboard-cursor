import { Download, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../lib/pwa';

export default function PwaInstallButton({ className = '' }) {
	const { canInstall, showIosHint, isInstalled, install } = usePwaInstall();

	if (isInstalled) return null;

	if (canInstall) {
		return (
			<button
				type="button"
				onClick={install}
				className={`btn-secondary w-full justify-center py-2 text-sm ${className}`}
			>
				<Download size={16} />
				Install app
			</button>
		);
	}

	if (showIosHint) {
		return (
			<p className={`flex items-center justify-center gap-1.5 text-center text-xs text-brand-300 ${className}`}>
				<Smartphone size={14} className="shrink-0" />
				Tap Share, then &ldquo;Add to Home Screen&rdquo;
			</p>
		);
	}

	return null;
}
