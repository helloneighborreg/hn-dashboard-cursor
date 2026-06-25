import { useCallback, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { CheckCircle2, Lock, Settings } from 'lucide-react';
import Layout from '../../components/Layout';
import AdminPasswordPrompt from '../../components/AdminPasswordPrompt';
import ChecklistGeofenceGate from '../../components/forms/ChecklistGeofenceGate';
import CjcTurnCleanChecklistForm from '../../components/forms/CjcTurnCleanChecklistForm';
import { fetchJson } from '../../lib/apiClient';
import { requireAuth } from '../../lib/auth';
import { captureChecklistLocation, CHECKLIST_LOCATION_REQUIRED_MESSAGE } from '../../lib/checklistGeolocationClient';
import { useAuth } from '../../components/AuthContext';
import {
	applyUrlParamsToFormValues,
	applyCalculations,
	CJC_TURN_CLEAN_FORM,
	CJC_TURN_CLEAN_FORM_SLUG,
	deserializeAnswers,
} from '../../lib/forms/cjcTurnCleanChecklist';
import { getSectionExamplesByForm } from '../../lib/forms/checklistSectionExamples';
import { persistChecklist } from '../../lib/forms/checklistSubmitClient';
import { getPropertyGeolocation } from '../../lib/propertyGeolocations';
import { getBaseCleaningRateForPropertyCode } from '../../lib/propertyBaseCleaningRate';
import {
	getFormSubmissionById,
	getFormSubmissionForReservation,
	isSubmissionLocked,
} from '../../lib/forms/checklistSubmissions';

function isUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export default function CjcTurnCleanChecklistPage({
	initialValues,
	resetValues,
	submissionId: initialSubmissionId = null,
	initialLocked = false,
	geolocationTarget = null,
	sectionExamples = {},
	dbError = null,
}) {
	const { isAdmin } = useAuth();
	const [submitted, setSubmitted] = useState(null);
	const [submissionId, setSubmissionId] = useState(initialSubmissionId);
	const [locked, setLocked] = useState(initialLocked);
	const [saving, setSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState('');
	const [unlockPromptOpen, setUnlockPromptOpen] = useState(false);
	const [unlocking, setUnlocking] = useState(false);
	const [unlockError, setUnlockError] = useState('');
	const [geofenceReady, setGeofenceReady] = useState(false);
	const [locationError, setLocationError] = useState('');
	const [submitProgress, setSubmitProgress] = useState('');
	const submissionIdRef = useRef(initialSubmissionId);

	const geofenceRequired = Boolean(geolocationTarget) && !locked && !isAdmin;

	async function resolveLocation() {
		if (!geofenceRequired) return null;
		return captureChecklistLocation(geolocationTarget);
	}

	function updateSubmissionId(id) {
		submissionIdRef.current = id;
		setSubmissionId(id);
	}

	const persistDraft = useCallback(async ({
		values,
		answers,
		location = null,
		onProgress = null,
	}) => {
		const json = await persistChecklist({
			values,
			answers,
			submissionId: submissionIdRef.current,
			save: true,
			location,
			onProgress,
		});
		if (!json?.data?.id) throw new Error('Could not save checklist');
		updateSubmissionId(json.data.id);
		setLocked(false);
		return json;
	}, []);

	async function handleAutoSave({ values, answers }) {
		await persistDraft({ values, answers });
	}

	async function handleSave({ values, answers }) {
		setSaving(true);
		setSaveMessage('');
		setLocationError('');
		setSubmitProgress('');
		try {
			await persistDraft({
				values,
				answers,
				onProgress: ({ phase, done, total }) => {
					if (phase === 'upload' && total > 0) {
						setSubmitProgress(`Uploading photos (${done}/${total})…`);
					}
				},
			});
			setSaveMessage('Checklist saved. You can return later to finish and submit.');
		} catch (err) {
			setLocationError(err.message || 'Could not save checklist');
		} finally {
			setSaving(false);
			setSubmitProgress('');
		}
	}

	async function handleSubmit({ values, answers }) {
		setLocationError('');
		setSubmitProgress('');
		try {
			const location = await resolveLocation();
			const json = await persistChecklist({
				values,
				answers,
				submissionId: submissionIdRef.current,
				save: false,
				location,
				onProgress: ({ phase, done, total }) => {
					if (phase === 'upload' && total > 0) {
						setSubmitProgress(`Uploading photos (${done}/${total})…`);
					} else if (phase === 'finalize') {
						setSubmitProgress('Finishing submission…');
					}
				},
			});
			if (!json) throw new Error('Could not submit checklist');
			setSubmitted(json.data);
			setSubmissionId(json.data.id);
			setLocked(true);
		} catch (err) {
			setLocationError(
				err.message === CHECKLIST_LOCATION_REQUIRED_MESSAGE
					? CHECKLIST_LOCATION_REQUIRED_MESSAGE
					: (err.message || 'Could not submit checklist'),
			);
			throw err;
		} finally {
			setSubmitProgress('');
		}
	}

	async function handleUnlock(password) {
		if (!submissionId) return;
		setUnlocking(true);
		setUnlockError('');
		try {
			const json = await fetchJson(`/api/forms/cjc-turn-clean-checklist/${submissionId}/unlock`, {
				method: 'POST',
				body: { admin_password: password },
			});
			if (!json) return;
			setLocked(false);
			setGeofenceReady(false);
			setUnlockPromptOpen(false);
			setSaveMessage('Checklist unlocked. You can edit and save again.');
		} catch (err) {
			setUnlockError(err.message || 'Incorrect admin password.');
		} finally {
			setUnlocking(false);
		}
	}

	if (submitted) {
		return (
			<Layout>
				<Head>
					<title>Checklist submitted — {CJC_TURN_CLEAN_FORM.name}</title>
				</Head>
				<div className="max-w-3xl mx-auto px-4 py-10 text-center space-y-4">
					<div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
						<CheckCircle2 size={28} />
					</div>
					<h1 className="text-xl font-semibold text-dark">Checklist submitted</h1>
					<p className="text-sm text-muted">
						Your turn clean checklist was saved.
					</p>
					{submitted?.task_completion_skipped === 'future_checkout' && (
						<p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
							Your checklist was saved, but the task was not marked complete because checkout is still in the future.
						</p>
					)}
					<div className="flex flex-wrap items-center justify-center gap-3 pt-2">
						<Link href="/forms/cjc-turn-clean-checklist" className="btn-primary">Back to checklist</Link>
						{submitted?.view_url && (
							<a href={submitted.view_url} className="btn-secondary">View submission</a>
						)}
					</div>
				</div>
			</Layout>
		);
	}

	return (
		<Layout>
			<Head>
				<title>{CJC_TURN_CLEAN_FORM.name}</title>
			</Head>
			<div className="max-w-3xl mx-auto py-6 sm:py-8">
				<div className="mb-6 text-center">
					<h1 className="text-2xl font-semibold text-dark">{CJC_TURN_CLEAN_FORM.name}</h1>
					{geolocationTarget && !isAdmin && (
						<p className="text-sm text-muted mt-1">{CHECKLIST_LOCATION_REQUIRED_MESSAGE}</p>
					)}
					{isAdmin && (
						<Link
							href="/forms/cjc-turn-clean-checklist/examples"
							className="inline-flex mt-3 items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 font-medium"
						>
							<Settings size={14} />
							Manage Example Photos
						</Link>
					)}
				</div>

				{dbError && (
					<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{dbError}
					</div>
				)}

				{locationError && (
					<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{locationError}
					</div>
				)}

				{submitProgress && (
					<div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
						{submitProgress}
					</div>
				)}

				<ChecklistGeofenceGate
					geolocationTarget={geofenceRequired ? geolocationTarget : null}
					disabled={!geofenceRequired}
					onVerified={() => setGeofenceReady(true)}
				>
					{(!geofenceRequired || geofenceReady) && (
						<>
							{locked && (
								<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
									<div className="flex items-start gap-2 text-sm text-amber-900">
										<Lock size={16} className="mt-0.5 shrink-0" />
										<span>This checklist is complete and locked.</span>
									</div>
									{isAdmin && (
										<button
											type="button"
											onClick={() => {
												setUnlockError('');
												setUnlockPromptOpen(true);
											}}
											className="btn-secondary text-sm shrink-0"
										>
											Unlock to edit
										</button>
									)}
								</div>
							)}

							<CjcTurnCleanChecklistForm
								initialValues={initialValues}
								resetValues={resetValues}
								onSubmit={handleSubmit}
								onSave={locked ? null : handleSave}
								onAutoSave={locked ? null : handleAutoSave}
								onClear={() => setSaveMessage('')}
								locked={locked}
								saving={saving}
								saveMessage={saveMessage}
								sectionExamples={sectionExamples}
							/>
						</>
					)}
				</ChecklistGeofenceGate>
			</div>

			<AdminPasswordPrompt
				open={unlockPromptOpen}
				title="Unlock checklist"
				description="This checklist is complete and locked. Enter an admin password to edit it."
				onSubmit={handleUnlock}
				onCancel={() => {
					setUnlockPromptOpen(false);
					setUnlockError('');
				}}
				submitting={unlocking}
				error={unlockError}
			/>
		</Layout>
	);
}

export const getServerSideProps = requireAuth(async (context) => {
	const { query } = context;
	const submissionId = String(query.submission_id || '').trim();
	const reservationId = String(
		query.ReservationID || query.reservation_id || query.cdyd || '',
	).trim();

	let submission = null;
	let dbError = null;
	try {
		if (isUuid(submissionId)) {
			submission = await getFormSubmissionById(submissionId);
		} else if (reservationId) {
			submission = await getFormSubmissionForReservation(reservationId);
		}
	} catch (err) {
		const message = err?.message || '';
		console.error('Checklist submission lookup failed:', message);
		if (/permission denied|does not exist|PGRST205/i.test(message)) {
			dbError = 'Checklist storage is not configured yet. Ask an admin to run supabase/migrations/20260629_form_submission_permissions.sql in Supabase.';
		} else {
			throw err;
		}
	}

	let defaults = applyUrlParamsToFormValues(query);
	if (!submission) {
		const propertyCode = defaults['jXsd'] || String(query.Property || query.property || '').trim();
		defaults = applyCalculations({
			...defaults,
			'43sB': await getBaseCleaningRateForPropertyCode(propertyCode),
		});
	}

	const initialValues = submission?.answers
		? deserializeAnswers(submission.answers)
		: defaults;

	const propertyCode = initialValues['jXsd'] || query.Property || query.property || '';
	const geolocationTarget = getPropertyGeolocation(propertyCode);

	let sectionExamples = {};
	try {
		sectionExamples = await getSectionExamplesByForm(CJC_TURN_CLEAN_FORM_SLUG);
	} catch (err) {
		const message = err?.message || '';
		if (!dbError && /form_checklist_section_examples/i.test(message) && /does not exist|PGRST205/i.test(message)) {
			dbError = 'Example photos are not configured yet. Admins can still use the checklist after running supabase/migrations/20260630_checklist_section_examples.sql.';
		} else if (!/form_checklist_section_examples/i.test(message)) {
			console.error('Checklist example photos lookup failed:', message);
		}
	}

	return {
		props: {
			initialValues,
			resetValues: defaults,
			submissionId: submission?.id || null,
			initialLocked: isSubmissionLocked(submission),
			geolocationTarget,
			sectionExamples,
			dbError,
		},
	};
});
