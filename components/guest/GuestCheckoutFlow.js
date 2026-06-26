import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { CheckCircle2, Home, Star } from 'lucide-react';
import clsx from 'clsx';
import { fetchJson } from '../../lib/apiClient';
import { formatDateWithWeekday } from '../../lib/dates';

const STEPS = {
	CODE: 'code',
	CONFIRM: 'confirm',
	FEEDBACK: 'feedback',
	DONE: 'done',
};

function StarRating({ value, onChange }) {
	return (
		<div className="flex items-center justify-center gap-1 sm:gap-2">
			{[1, 2, 3, 4, 5].map((star) => (
				<button
					key={star}
					type="button"
					onClick={() => onChange(star === value ? null : star)}
					className="min-h-11 min-w-11 p-2 rounded-lg transition-colors hover:bg-brand-50 active:bg-brand-100 touch-manipulation"
					aria-label={`${star} star${star !== 1 ? 's' : ''}`}
				>
					<Star
						size={28}
						className={clsx(
							star <= (value || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300',
						)}
					/>
				</button>
			))}
		</div>
	);
}

export default function GuestCheckoutFlow({ initialCode = '', routerReady = true }) {
	const [step, setStep] = useState(STEPS.CODE);
	const [code, setCode] = useState(initialCode);
	const [checkout, setCheckout] = useState(null);
	const [rating, setRating] = useState(null);
	const [feedback, setFeedback] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const autoLookupStarted = useRef(false);
	const submitStarted = useRef(false);

	useEffect(() => {
		if (initialCode) setCode(initialCode);
	}, [initialCode]);

	useEffect(() => {
		if (!routerReady || !initialCode || initialCode.length !== 6 || autoLookupStarted.current) return;
		autoLookupStarted.current = true;
		lookupCode(initialCode);
	}, [routerReady, initialCode]);

	async function lookupCode(submittedCode = code) {
		setError('');
		setLoading(true);
		try {
			const json = await fetchJson('/api/guest-checkout/lookup', {
				method: 'POST',
				body: { code: submittedCode },
				redirectOn401: false,
			});
			const data = json?.data;
			if (!data) throw new Error('Could not look up checkout code.');

			setCheckout(data);
			if (data.already_confirmed) {
				setStep(STEPS.DONE);
			} else {
				setStep(STEPS.CONFIRM);
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	async function submitCheckout() {
		if (submitStarted.current) return;
		submitStarted.current = true;
		setError('');
		setLoading(true);
		try {
			const json = await fetchJson('/api/guest-checkout/confirm', {
				method: 'POST',
				body: {
					code,
					rating,
					feedback: feedback.trim() || null,
				},
				redirectOn401: false,
			});
			setCheckout(json?.data || checkout);
			setStep(STEPS.DONE);
		} catch (err) {
			if (err.status === 409 || err.message?.includes('already been confirmed')) {
				if (err.data) setCheckout(err.data);
				setStep(STEPS.DONE);
				return;
			}
			submitStarted.current = false;
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	function handleCodeSubmit(e) {
		e.preventDefault();
		lookupCode();
	}

	return (
		<>
			<Head>
				<title>Confirm Checkout — Hello Neighbor</title>
			</Head>
			<div
				className="min-h-[100dvh] bg-gradient-to-br from-brand-900 via-brand-800 to-dark flex items-center justify-center p-4"
				style={{
					paddingTop: 'max(1rem, env(safe-area-inset-top))',
					paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
				}}
			>
				<div className="w-full max-w-md">
					<div className="text-center mb-6">
						<div className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 mb-3 shadow-lg">
							<Image
								src="/logo.png"
								alt="Hello Neighbor Real Estate Group"
								width={240}
								height={40}
								priority
								className="h-8 w-auto"
							/>
						</div>
						<p className="text-brand-200 text-sm">Guest Checkout</p>
					</div>

					<div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
						{!routerReady && (
							<div className="space-y-4" aria-busy="true">
								<div className="text-center space-y-2">
									<h1 className="text-xl font-semibold text-dark">Confirm Your Checkout</h1>
									<p className="text-sm text-muted">
										Please enter your provided checkout code.
									</p>
								</div>
								<div>
									<input
										id="checkout-code-loading"
										type="text"
										disabled
										aria-label="Checkout code"
										className="input text-center text-base sm:text-2xl tracking-[0.35em] font-mono uppercase opacity-60"
										placeholder="123ABC"
									/>
								</div>
								<button type="button" disabled className="btn-primary w-full justify-center min-h-11 opacity-60">
									Loading…
								</button>
							</div>
						)}

						{routerReady && step === STEPS.CODE && (
							<form onSubmit={handleCodeSubmit} className="space-y-4">
								<div className="text-center space-y-2">
									<h1 className="text-xl font-semibold text-dark">Confirm Your Checkout</h1>
									<p className="text-sm text-muted">
										Please enter your provided checkout code.
									</p>
								</div>
								<div>
									<input
										id="checkout-code"
										name="checkout-code"
										type="text"
										inputMode="text"
										autoComplete="one-time-code"
										autoCapitalize="characters"
										autoCorrect="off"
										spellCheck={false}
										enterKeyHint="go"
										aria-label="Checkout code"
										maxLength={6}
										value={code}
										onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6))}
										className="input text-center text-base sm:text-2xl tracking-[0.35em] font-mono uppercase"
										placeholder="123ABC"
										required
									/>
								</div>
								{error && <p className="text-sm text-red-600">{error}</p>}
								<button
									type="submit"
									disabled={loading || code.length !== 6}
									className="btn-primary w-full justify-center min-h-11 touch-manipulation"
								>
									{loading ? 'Checking…' : 'Continue'}
								</button>
							</form>
						)}

						{step === STEPS.CONFIRM && checkout && (
							<div className="space-y-5">
								<div className="text-center space-y-2">
									<div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
										<Home size={22} className="text-brand-600" />
									</div>
									<h1 className="text-xl font-semibold text-dark">Please Confirm Your Property &amp; Checkout Date.</h1>
								</div>
								<div className="rounded-xl border border-border bg-gray-50 px-4 py-4 text-center">
									<p className="text-lg font-semibold text-dark">{checkout.property_name}</p>
									{checkout.checkout_date && (
										<p className="text-sm text-muted mt-1">
											{formatDateWithWeekday(checkout.checkout_date)}
										</p>
									)}
									{checkout.property_image_url && (
										<div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-lg">
											<Image
												src={checkout.property_image_url}
												alt={checkout.property_name || 'Property'}
												fill
												className="object-cover"
												sizes="(max-width: 448px) 100vw, 448px"
											/>
										</div>
									)}
								</div>
								{error && <p className="text-sm text-red-600">{error}</p>}
								<div className="flex flex-col gap-2">
									<button
										type="button"
										onClick={() => setStep(STEPS.FEEDBACK)}
										className="btn-primary w-full justify-center min-h-11 touch-manipulation"
									>
										Confirmed
									</button>
									<button
										type="button"
										onClick={() => {
											setStep(STEPS.CODE);
											setCheckout(null);
											setError('');
										}}
										className="btn-secondary w-full justify-center min-h-11 touch-manipulation"
									>
										No, Please Go Back.
									</button>
								</div>
							</div>
						)}

						{step === STEPS.FEEDBACK && (
							<div className="space-y-5">
								<div className="text-center space-y-2">
									<h1 className="text-xl font-semibold text-dark">We&apos;d Love To Hear From You.</h1>
									<p className="text-sm text-muted leading-relaxed">
										We&apos;re always looking for ways to improve, and your feedback means a lot.
									</p>
								</div>

								<div className="space-y-2">
									<p className="label text-center">Overall Rating</p>
									<StarRating value={rating} onChange={setRating} />
								</div>

								<div>
									<label className="label" htmlFor="guest-feedback">Additional Feedback</label>
									<textarea
										id="guest-feedback"
										rows={4}
										value={feedback}
										onChange={(e) => setFeedback(e.target.value)}
										className="input resize-y"
									/>
								</div>

								{error && <p className="text-sm text-red-600">{error}</p>}

								<div className="flex flex-col gap-2">
									<button
										type="button"
										onClick={submitCheckout}
										disabled={loading}
										className="btn-primary w-full justify-center min-h-11 touch-manipulation"
									>
										{loading ? 'Submitting…' : 'Submit'}
									</button>
									<button
										type="button"
										onClick={submitCheckout}
										disabled={loading}
										className="btn-secondary w-full justify-center min-h-11 touch-manipulation text-sm"
									>
										Skip
									</button>
								</div>
							</div>
						)}

						{step === STEPS.DONE && (
							<div className="text-center space-y-4 py-2">
								<div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
									<CheckCircle2 size={30} className="text-green-600" />
								</div>
								<div className="space-y-2">
									<h1 className="text-xl font-semibold text-dark">Checkout Confirmed!</h1>
									<div className="text-sm text-muted leading-relaxed space-y-1">
										<p>Thank You and Safe Travels!</p>
										<p>We Hope To See You Again Soon.</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
