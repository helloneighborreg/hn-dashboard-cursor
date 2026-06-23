import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, X, Aperture } from 'lucide-react';
import {
	buildCameraCaptureEntry,
	captureFrameFromVideo,
	openBackCameraStream,
	stopMediaStream,
} from '../../lib/cameraCapture';

export default function CameraCaptureField({ id, label, value = [], onChange, error, required, readOnly = false }) {
	const videoRef = useRef(null);
	const streamRef = useRef(null);
	const [cameraOpen, setCameraOpen] = useState(false);
	const [cameraError, setCameraError] = useState('');
	const [capturing, setCapturing] = useState(false);
	const files = Array.isArray(value) ? value : [];

	const closeCamera = useCallback(() => {
		stopMediaStream(streamRef.current);
		streamRef.current = null;
		if (videoRef.current) videoRef.current.srcObject = null;
		setCameraOpen(false);
		setCameraError('');
	}, []);

	useEffect(() => () => stopMediaStream(streamRef.current), []);

	async function startCamera() {
		setCameraError('');
		try {
			const stream = await openBackCameraStream();
			streamRef.current = stream;
			setCameraOpen(true);
			requestAnimationFrame(() => {
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					videoRef.current.play().catch(() => {});
				}
			});
		} catch (err) {
			setCameraError(err.message || 'Could not access the camera. Allow camera permission and try again.');
		}
	}

	async function takePhoto() {
		const video = videoRef.current;
		if (!video || !video.videoWidth) return;

		setCapturing(true);
		try {
			const capturedAt = new Date();
			const frame = captureFrameFromVideo(video);
			const entry = await buildCameraCaptureEntry(frame, capturedAt);
			onChange([...files, entry]);
			closeCamera();
		} catch (err) {
			setCameraError(err.message || 'Could not save photo');
		} finally {
			setCapturing(false);
		}
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
					error ? 'border-red-300 bg-red-50/40' : 'border-border bg-gray-50/60',
				)}
			>
				{!readOnly && (
					<button
						type="button"
						id={id}
						onClick={startCamera}
						className="btn-secondary w-full justify-center"
						disabled={cameraOpen}
					>
						<Camera size={16} />
						Take photo{files.length ? ' (another)' : ''}
					</button>
				)}

				{(cameraError || error) && (
					<p className="text-xs text-red-600 mt-2">{cameraError || error}</p>
				)}

				{files.length > 0 && (
					<ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
						{files.map((file, index) => (
							<li key={file.localId || file.storage_path || index} className="relative group">
								<img
									src={file.previewUrl || file.url}
									alt={file.filename || 'Captured photo'}
									className="w-full h-24 object-cover rounded-lg border border-border"
								/>
								{!readOnly && (
									<button
										type="button"
										onClick={() => removeAt(index)}
										className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-90 hover:opacity-100"
										aria-label="Remove photo"
									>
										<X size={12} />
									</button>
								)}
							</li>
						))}
					</ul>
				)}
			</div>

			{cameraOpen && (
				<div className="fixed inset-0 z-50 flex flex-col bg-black">
					<div className="flex items-center justify-end px-4 py-3 bg-black/80 text-white">
						<button
							type="button"
							onClick={closeCamera}
							className="p-2 rounded-full hover:bg-white/10"
							aria-label="Close camera"
						>
							<X size={20} />
						</button>
					</div>
					<div className="flex-1 relative overflow-hidden bg-black">
						<video
							ref={videoRef}
							playsInline
							muted
							autoPlay
							className="absolute inset-0 w-full h-full object-cover"
						/>
					</div>
					<div className="px-4 py-5 bg-black/90 flex flex-col items-center gap-3">
						{cameraError && (
							<p className="text-xs text-red-300 text-center">{cameraError}</p>
						)}
						<button
							type="button"
							onClick={takePhoto}
							disabled={capturing}
							className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white disabled:opacity-50"
							aria-label="Capture photo"
						>
							<Aperture size={28} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
