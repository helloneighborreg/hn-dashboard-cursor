import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, CheckCircle2, Cloud, Loader2 } from 'lucide-react';
import ChecklistFormField from './ChecklistFormField';
import ChecklistSectionExamples from './ChecklistSectionExamples';
import {
	CJC_TURN_CLEAN_FORM,
	HEADER_QUESTION_IDS,
	ADDITIONAL_CHARGES_QUESTION_IDS,
	buildChecklistRoomGroups,
	getQuestion,
	isRoomGroupComplete,
	applyCalculations,
	validateForm,
	serializeAnswers,
} from '../../lib/forms/cjcTurnCleanChecklist';
import { stripUploadedBase64 } from '../../lib/forms/checklistSubmitClient';

const AUTO_SAVE_DELAY_MS = 2500;

function HeaderFieldGrid({ values, errors, onFieldChange, readOnly, sectionExamples = {} }) {
	const headerQuestions = CJC_TURN_CLEAN_FORM.questions.filter((q) => HEADER_QUESTION_IDS.has(q.id));
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{headerQuestions.map((q) => (
				<div key={q.id} className={q.type === 'FileUpload' ? 'sm:col-span-2' : ''}>
					{q.type === 'FileUpload' && (
						<ChecklistSectionExamples photos={sectionExamples[q.id] || []} />
					)}
					<ChecklistFormField
						question={q}
						value={values[q.id]}
						onChange={(next) => onFieldChange(q.id, next)}
						error={errors[q.id]}
						readOnly={readOnly}
					/>
				</div>
			))}
		</div>
	);
}

function SectionPanel({
	section,
	values,
	errors,
	onFieldChange,
	readOnly,
	sectionExamples = {},
}) {
	return (
		<div className="rounded-lg border border-border bg-gray-50/40 p-4 space-y-4">
			<h3 className="text-sm font-medium text-dark">{section.areaTitle}</h3>
			<ChecklistSectionExamples photos={sectionExamples[section.id] || []} />
			{section.checklist && (
				<ChecklistFormField
					question={section.checklist}
					value={values[section.checklist.id]}
					onChange={(next) => onFieldChange(section.checklist.id, next)}
					error={errors[section.checklist.id]}
					readOnly={readOnly}
				/>
			)}
			{section.photo && (
				<ChecklistFormField
					question={section.photo}
					value={values[section.photo.id]}
					onChange={(next) => onFieldChange(section.photo.id, next)}
					error={errors[section.photo.id]}
					readOnly={readOnly}
				/>
			)}
		</div>
	);
}

function RoomGroupAccordion({
	group,
	index,
	values,
	errors,
	onFieldChange,
	open,
	onToggle,
	readOnly,
	sectionExamples = {},
}) {
	const complete = isRoomGroupComplete(group, values);

	return (
		<div className="card overflow-hidden">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
			>
				<span className={clsx(
					'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold flex-shrink-0',
					complete ? 'bg-green-100 text-green-700' : 'bg-brand-100 text-brand-700',
				)}>
					{complete ? <CheckCircle2 size={14} /> : index + 1}
				</span>
				<span className="flex-1 min-w-0">
					<span className="block font-medium text-sm text-dark">{group.title}</span>
					<span className="block text-xs text-muted mt-0.5">
						{group.sections.length} area{group.sections.length === 1 ? '' : 's'}
					</span>
				</span>
				<ChevronDown size={16} className={clsx('text-muted transition-transform shrink-0', open && 'rotate-180')} />
			</button>
			{open && (
				<div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
					{group.sections.map((section) => (
						<SectionPanel
							key={section.id}
							section={section}
							values={values}
							errors={errors}
							onFieldChange={onFieldChange}
							readOnly={readOnly}
							sectionExamples={sectionExamples}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function AdditionalChargesSection({ values, errors, onFieldChange, readOnly }) {
	const showAdditional = values['kmJc'] === 'Yes';
	const questions = CJC_TURN_CLEAN_FORM.questions.filter((q) => ADDITIONAL_CHARGES_QUESTION_IDS.has(q.id));

	return (
		<div className="card p-4 sm:p-5 space-y-4">
			<h2 className="text-sm font-semibold text-dark">Additional Charges</h2>
			{questions.map((q) => {
				if (q.id === '7Mpe' || q.id === 'jxUf' || q.id === '7p1o') {
					if (!showAdditional) return null;
				}
				return (
					<ChecklistFormField
						key={q.id}
						question={q}
						value={values[q.id]}
						onChange={(next) => onFieldChange(q.id, next)}
						error={errors[q.id]}
						readOnly={readOnly}
					/>
				);
			})}
		</div>
	);
}

function MaintenanceSection({ values, errors, onFieldChange, readOnly }) {
	const showMaintenance = values['kMt1'] === 'Yes';
	const maintenanceQuestion = getQuestion('kMt1');
	const detailsQuestion = getQuestion('kMt2');
	const photoQuestion = getQuestion('kMt3');

	return (
		<div className="card p-4 sm:p-5 space-y-4">
			<h2 className="text-sm font-semibold text-dark">Maintenance</h2>
			<ChecklistFormField
				question={maintenanceQuestion}
				value={values['kMt1']}
				onChange={(next) => onFieldChange('kMt1', next)}
				error={errors['kMt1']}
				readOnly={readOnly}
			/>
			{showMaintenance && (
				<div className="rounded-lg border border-border bg-gray-50/40 p-4 space-y-4">
					<h3 className="text-sm font-medium text-dark">Maintenance Request Details</h3>
					<ChecklistFormField
						question={detailsQuestion}
						value={values['kMt2']}
						onChange={(next) => onFieldChange('kMt2', next)}
						error={errors['kMt2']}
						readOnly={readOnly}
						hideLabel
					/>
					<ChecklistFormField
						question={photoQuestion}
						value={values['kMt3']}
						onChange={(next) => onFieldChange('kMt3', next)}
						error={errors['kMt3']}
						readOnly={readOnly}
						required={false}
					/>
				</div>
			)}
		</div>
	);
}

function NotesSection({ values, errors, onFieldChange, readOnly }) {
	const notesQuestion = getQuestion('aaYL');
	if (!notesQuestion) return null;

	return (
		<div className="card p-4 sm:p-5 space-y-4">
			<h2 className="text-sm font-semibold text-dark">Notes</h2>
			<ChecklistFormField
				question={notesQuestion}
				value={values['aaYL']}
				onChange={(next) => onFieldChange('aaYL', next)}
				error={errors['aaYL']}
				readOnly={readOnly}
				hideLabel
			/>
		</div>
	);
}

export default function CjcTurnCleanChecklistForm({
	initialValues,
	resetValues,
	onSubmit,
	onSave,
	onAutoSave,
	onClear,
	submitLabel = 'Submit',
	locked = false,
	saving = false,
	saveMessage = '',
	sectionExamples = {},
}) {
	const roomGroups = useMemo(() => buildChecklistRoomGroups(), []);
	const [values, setValues] = useState(() => applyCalculations(initialValues));
	const [errors, setErrors] = useState({});
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState('');
	const [openRoomId, setOpenRoomId] = useState(roomGroups[0]?.id || null);
	const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
	const [autoSaveTick, setAutoSaveTick] = useState(0);
	const skipAutoSaveRef = useRef(true);
	const autoSaveInFlightRef = useRef(false);
	const autoSaveQueuedRef = useRef(false);

	useEffect(() => {
		if (locked || !onAutoSave || saving || submitting) return;

		if (skipAutoSaveRef.current) {
			skipAutoSaveRef.current = false;
			return;
		}

		const timer = setTimeout(async () => {
			if (autoSaveInFlightRef.current) {
				autoSaveQueuedRef.current = true;
				return;
			}

			autoSaveInFlightRef.current = true;
			setAutoSaveStatus('saving');
			const computed = applyCalculations(values);
			try {
				await onAutoSave({
					values: computed,
					answers: serializeAnswers(computed),
				});
				setValues((prev) => stripUploadedBase64(applyCalculations(prev)));
				setAutoSaveStatus('saved');
			} catch {
				setAutoSaveStatus('error');
			} finally {
				autoSaveInFlightRef.current = false;
				if (autoSaveQueuedRef.current) {
					autoSaveQueuedRef.current = false;
					setAutoSaveTick((tick) => tick + 1);
				}
			}
		}, AUTO_SAVE_DELAY_MS);

		return () => clearTimeout(timer);
	}, [values, autoSaveTick, locked, onAutoSave, saving, submitting]);

	function onFieldChange(id, next) {
		if (locked) return;
		setValues((prev) => applyCalculations({ ...prev, [id]: next }));
		if (errors[id]) {
			setErrors((prev) => {
				const copy = { ...prev };
				delete copy[id];
				return copy;
			});
		}
	}

	async function handleSave(e) {
		e.preventDefault();
		if (locked || !onSave) return;
		setSubmitError('');
		try {
			await onSave({
				values: applyCalculations(values),
				answers: serializeAnswers(applyCalculations(values)),
			});
			setValues((prev) => stripUploadedBase64(applyCalculations(prev)));
			setAutoSaveStatus('saved');
		} catch (err) {
			setSubmitError(err.message || 'Could not save form');
		}
	}

	function handleClear() {
		if (locked) return;
		if (!window.confirm('Clear all entered data and start over? Unsaved changes will be lost.')) return;
		skipAutoSaveRef.current = true;
		setValues(applyCalculations(resetValues ?? initialValues));
		setErrors({});
		setSubmitError('');
		setAutoSaveStatus('idle');
		setOpenRoomId(roomGroups[0]?.id || null);
		onClear?.();
	}

	async function handleSubmit(e) {
		e.preventDefault();
		setSubmitError('');
		const nextErrors = validateForm(values);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length) {
			const firstKey = Object.keys(nextErrors)[0];
			const el = document.getElementById(`field-${firstKey}`) || document.querySelector(`[name="${firstKey}"]`);
			el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
			return;
		}

		setSubmitting(true);
		try {
			await onSubmit({
				values: applyCalculations(values),
				answers: serializeAnswers(applyCalculations(values)),
			});
		} catch (err) {
			setSubmitError(err.message || 'Could not submit form');
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6 pb-36 sm:pb-28">
			<div className="card p-4 sm:p-5 space-y-4">
				<div>
					<h2 className="text-sm font-semibold text-dark">Reservation Details</h2>
				</div>
				<HeaderFieldGrid
					values={values}
					errors={errors}
					onFieldChange={onFieldChange}
					readOnly={locked}
					sectionExamples={sectionExamples}
				/>
			</div>

			<div className="space-y-3">
				{roomGroups.map((group, index) => (
					<RoomGroupAccordion
						key={group.id}
						group={group}
						index={index}
						values={values}
						errors={errors}
						onFieldChange={onFieldChange}
						open={openRoomId === group.id}
						onToggle={() => setOpenRoomId((cur) => (cur === group.id ? null : group.id))}
						readOnly={locked}
						sectionExamples={sectionExamples}
					/>
				))}
			</div>

			<AdditionalChargesSection values={values} errors={errors} onFieldChange={onFieldChange} readOnly={locked} />
			<MaintenanceSection values={values} errors={errors} onFieldChange={onFieldChange} readOnly={locked} />
			<NotesSection values={values} errors={errors} onFieldChange={onFieldChange} readOnly={locked} />

			{saveMessage && (
				<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
					{saveMessage}
				</div>
			)}

			{submitError && (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{submitError}
				</div>
			)}

			{!locked && (
				<div className="mobile-action-bar">
					<div className="max-w-3xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2 min-w-0">
							<button
								type="button"
								onClick={handleClear}
								className="btn-secondary text-sm shrink-0"
								disabled={saving || submitting}
							>
								Clear
							</button>
							{onAutoSave && autoSaveStatus !== 'idle' && (
								<span className={clsx(
									'inline-flex items-center gap-1.5 text-xs min-w-0',
									autoSaveStatus === 'error' ? 'text-red-600' : 'text-muted',
								)}>
									{autoSaveStatus === 'saving' && (
										<>
											<Loader2 size={12} className="animate-spin shrink-0" />
											<span>Saving…</span>
										</>
									)}
									{autoSaveStatus === 'saved' && (
										<>
											<Cloud size={12} className="shrink-0 text-green-600" />
											<span className="text-green-700">Saved</span>
										</>
									)}
									{autoSaveStatus === 'error' && (
										<span>Save failed</span>
									)}
								</span>
							)}
						</div>
						<div className="flex items-center gap-2 w-full sm:w-auto">
							{onSave && (
								<button
									type="button"
									onClick={handleSave}
									className="btn-secondary flex-1 sm:flex-none justify-center"
									disabled={saving || submitting}
								>
									{saving ? <Loader2 size={16} className="animate-spin" /> : null}
									{saving ? 'Saving…' : 'Save'}
								</button>
							)}
							<button
								type="submit"
								className="btn-primary flex-1 sm:flex-none justify-center"
								disabled={submitting || saving}
							>
								{submitting ? <Loader2 size={16} className="animate-spin" /> : null}
								{submitting ? 'Submitting…' : (
									<>
										<span className="sm:hidden">Submit</span>
										<span className="hidden sm:inline">{submitLabel}</span>
									</>
								)}
							</button>
						</div>
					</div>
				</div>
			)}
		</form>
	);
}

export { getQuestion };
