import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '../lib/pwa';

export default function PwaNotificationSettings({ compact = false, collapsed = false, className = '' }) {
	const { supported, subscribed, loading, error, subscribe, unsubscribe } = usePushNotifications();

	if (!supported) return null;

	if (compact) {
		const label = subscribed ? 'Notifications on' : 'Enable notifications';
		const Icon = subscribed ? BellRing : Bell;
		return (
			<div className={className}>
				<button
					type="button"
					onClick={() => (subscribed ? unsubscribe() : subscribe()).catch(() => {})}
					disabled={loading}
					title={label}
					aria-label={label}
					className={`w-full flex items-center rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-60 ${
						collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
					}`}
				>
					<Icon size={collapsed ? 18 : 16} />
					{!collapsed ? <span>{label}</span> : null}
				</button>
				{error && !collapsed ? <p className="mt-2 px-3 text-xs text-red-300">{error}</p> : null}
			</div>
		);
	}

	return (
		<div className={`card p-6 ${className}`}>
			<div className="flex items-start gap-4">
				<div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
					{subscribed ? (
						<BellRing size={28} className="text-brand-500" strokeWidth={1.5} />
					) : (
						<Bell size={28} className="text-brand-500" strokeWidth={1.5} />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<h2 className="font-semibold text-dark text-lg mb-1">Push notifications</h2>
					<p className="text-sm text-muted mb-4">
						Get alerts for task assignments, schedule changes, and completions — even when the app is closed.
					</p>
					{subscribed ? (
						<button
							type="button"
							onClick={() => unsubscribe().catch(() => {})}
							disabled={loading}
							className="btn-secondary text-sm"
						>
							<BellOff size={16} />
							Turn off notifications
						</button>
					) : (
						<button
							type="button"
							onClick={() => subscribe().catch(() => {})}
							disabled={loading}
							className="btn-primary text-sm"
						>
							<Bell size={16} />
							Enable notifications
						</button>
					)}
					{error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
				</div>
			</div>
		</div>
	);
}
