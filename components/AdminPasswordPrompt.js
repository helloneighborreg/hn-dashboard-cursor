import { useEffect, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useFocusTrap } from '../lib/useFocusTrap';

export default function AdminPasswordPrompt({
	open,
	title = 'Admin password required',
	description = 'This reservation is on an owner statement and is locked. Enter an admin password to continue.',
	onSubmit,
	onCancel,
	submitting = false,
	error = '',
}) {
	const [password, setPassword] = useState('');
	const inputRef = useRef(null);
	const dialogRef = useFocusTrap(open);

	useEscapeKey(open ? onCancel : undefined);

	useEffect(() => {
		if (!open) {
			setPassword('');
			return undefined;
		}
		const timer = setTimeout(() => inputRef.current?.focus(), 0);
		return () => clearTimeout(timer);
	}, [open]);

	if (!open) return null;

	function handleSubmit(e) {
		e.preventDefault();
		onSubmit?.(password);
	}

	return (
		<>
			<div
				className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
				onClick={onCancel}
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label={title}
				tabIndex={-1}
				className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl border border-border focus:outline-none"
			>
				<div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
					<div className="flex items-start gap-3 min-w-0">
						<div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
							<Lock size={18} aria-hidden />
						</div>
						<div className="min-w-0">
							<h2 className="text-base font-semibold text-dark">{title}</h2>
							<p className="text-sm text-muted mt-1">{description}</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onCancel}
						className="p-2 rounded-lg text-muted hover:text-dark hover:bg-gray-100"
						aria-label="Close"
					>
						<X size={18} />
					</button>
				</div>
				<form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
					<div>
						<label htmlFor="admin-password" className="block text-xs font-medium text-muted mb-1.5">
							Admin password
						</label>
						<input
							ref={inputRef}
							id="admin-password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="input w-full"
							placeholder="Enter admin password"
							disabled={submitting}
						/>
					</div>
					{error && (
						<p className="text-xs text-red-600">{error}</p>
					)}
					<div className="flex items-center justify-end gap-2 pt-1">
						<button
							type="button"
							onClick={onCancel}
							disabled={submitting}
							className="btn-secondary text-sm"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={submitting || !password}
							className="btn-primary text-sm"
						>
							{submitting ? 'Verifying…' : 'Unlock'}
						</button>
					</div>
				</form>
			</div>
		</>
	);
}
