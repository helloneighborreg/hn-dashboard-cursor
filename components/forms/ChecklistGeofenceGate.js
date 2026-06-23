import { useCallback, useEffect, useState } from 'react';
import { MapPin, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import {
	captureChecklistLocation,
	CHECKLIST_LOCATION_REQUIRED_MESSAGE,
} from '../../lib/checklistGeolocationClient';

export default function ChecklistGeofenceGate({
	geolocationTarget,
	disabled = false,
	onVerified,
	children,
}) {
	const { isAdmin } = useAuth();
	const [status, setStatus] = useState('idle');

	const verify = useCallback(async () => {
		if (disabled || !geolocationTarget) {
			setStatus('ok');
			onVerified?.(null);
			return;
		}

		if (isAdmin) {
			setStatus('ok');
			onVerified?.(null);
			return;
		}

		setStatus('checking');

		try {
			const location = await captureChecklistLocation(geolocationTarget);
			setStatus('ok');
			onVerified?.(location);
		} catch {
			setStatus('blocked');
			onVerified?.(null);
		}
	}, [disabled, geolocationTarget, isAdmin, onVerified]);

	useEffect(() => {
		verify();
	}, [verify]);

	if (disabled || !geolocationTarget || status === 'ok') {
		return children;
	}

	return (
		<div className="card p-6 sm:p-8 text-center space-y-4">
			<div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
				{status === 'checking' ? <Loader2 size={22} className="animate-spin" /> : <MapPin size={22} />}
			</div>
			{status === 'blocked' && (
				<p className="text-sm text-red-600 max-w-md mx-auto font-medium">
					{CHECKLIST_LOCATION_REQUIRED_MESSAGE}
				</p>
			)}
			<button
				type="button"
				onClick={verify}
				disabled={status === 'checking'}
				className="btn-primary mx-auto justify-center min-w-[10rem]"
			>
				<RefreshCw size={16} className={status === 'checking' ? 'animate-spin' : ''} />
				{status === 'checking' ? 'Checking location…' : 'Try again'}
			</button>
		</div>
	);
}
