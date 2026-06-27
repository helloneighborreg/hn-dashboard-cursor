import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useAuth } from './AuthContext';
import { ErrorState } from './LoadingSpinner';
import { fetchJson } from '../lib/apiClient';

export default function AnnouncementBroadcast({ className = '' }) {
	const { isAdmin } = useAuth();
	const [message, setMessage] = useState('');
	const [sending, setSending] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState(null);

	if (!isAdmin) return null;

	async function handleSend() {
		const trimmed = message.trim();
		if (!trimmed) {
			setError('Enter a message to send.');
			return;
		}

		setSending(true);
		setError('');
		setResult(null);

		try {
			const json = await fetchJson('/api/notifications/broadcast', {
				method: 'POST',
				body: { message: trimmed },
			});
			setResult(json?.data || null);
			setMessage('');
		} catch (err) {
			setError(err.message || 'Could not send notification.');
		} finally {
			setSending(false);
		}
	}

	return (
		<div className={`card p-6 ${className}`}>
			<div className="flex items-start gap-4">
				<div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
					<Megaphone size={28} className="text-brand-500" strokeWidth={1.5} />
				</div>
				<div className="flex-1 min-w-0">
					<h2 className="font-semibold text-dark text-lg mb-1">Send announcement</h2>
					<p className="text-sm text-muted mb-4">
						Push a message to everyone who has notifications enabled in the app.
					</p>

					<textarea
						value={message}
						onChange={(e) => {
							setMessage(e.target.value);
							setError('');
							setResult(null);
						}}
						rows={3}
						maxLength={500}
						placeholder="Have a good weekend!"
						className="w-full text-sm text-dark border border-border rounded-md px-3 py-2 resize-y min-h-[5rem] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
					/>

					<div className="mt-3 flex items-center justify-between gap-3">
						<span className="text-xs text-muted">{message.length}/500</span>
						<button
							type="button"
							onClick={handleSend}
							disabled={sending || !message.trim()}
							className="btn-primary text-sm"
						>
							{sending ? 'Sending…' : 'Send to all users'}
						</button>
					</div>

					{error ? (
						<div className="mt-3">
							<ErrorState message={error} />
						</div>
					) : null}

					{result ? (
						<p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
							Sent to {result.users_notified} user{result.users_notified === 1 ? '' : 's'}
							{' '}({result.sent} device{result.sent === 1 ? '' : 's'}).
						</p>
					) : null}
				</div>
			</div>
		</div>
	);
}
