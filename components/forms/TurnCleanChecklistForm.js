import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, CheckCircle2, Cloud, Loader2 } from 'lucide-react';
import ChecklistFormField from './ChecklistFormField';
import ChecklistSectionExamples from './ChecklistSectionExamples';
import * as defaultFormBinding from '../../lib/forms/cjcTurnCleanChecklist';
import { applyUploadedFilesToValues } from '../../lib/forms/checklistSubmitClient';

const AUTO_SAVE_DELAY_MS = 2500;

function HeaderFieldGrid({ formBinding, values, errors, onFieldChange, readOnly, sectionExamples = {} }) {
	const headerQuestions = formBinding.TURN_CLEAN_FORM.questions.filter((q) => formBinding.HEADER_QUESTION_IDS.has(q.id));
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
	formBinding,
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
	const complete = formBinding.isRoomGroupComplete(group, values);

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

function AdditionalChargesSection({ formBinding, values, errors, onFieldChange, readOnly }) {
	const ids = formBinding.CHECKLIST_IDS;
	const showAdditional = values[ids.additionalCharge] === 'Yes';
	const questions = formBinding.TURN_CLEAN_FORM.questions.filter((q) => formBinding.ADDITIONAL_CHARGES_QUESTION_IDS.has(q.id));

	return (
		<div className="card p-4 sm:p-5 space-y-4">
			<h2 className="text-sm font-semibold text-dark">Additional Charges</h2>
			{questions.map((q) => {
				if (q.id === ids.additionalAmount || q.id === ids.additionalDetails || q.id === ids.additionalPhoto) {
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

function MaintenanceSection({ formBinding, values, errors, onFieldChange, readOnly }) {
	const ids = formBinding.CHECKLIST_IDS;
	if (!ids.maintenance) return null;

	const showMaintenance = values[ids.maintenance] === 'Yes';
	const maintenanceQuestion = formBinding.getQuestion(ids.maintenance);
	const detailsQuestion = formBinding.getQuestion(ids.maintenanceDetails);
	const photoQuestion = formBinding.getQuestion(ids.maintenancePhoto);

	return (
		<div className="card p-4 sm:p-5 space-y-4">
			<h2 className="text-sm font-semibold text-dark">Maintenance</h2>
			<ChecklistFormField
				question={maintenanceQuestion}
				value={values[ids.maintenance]}
				onChange={(next) => onFieldChange(ids.maintenance, next)}
				error={errors[ids.maintenance]}
				readOnly={readOnly}
			/>
			{showMaintenance && (
				<div className="rounded-lg border border-border bg-gray-50/40 p-4 space-y-4">
					<h3 className="text-sm font-medium text-dark">Maintenance Request Details</h3>
					<ChecklistFormField
						question={detailsQuestion}
						value={values[ids.maintenanceDetails]}
						onChange={(next) => onFieldChange(ids.maintenanceDetails, next)}
						error={errors[ids.maintenanceDetails]}
						readOnly={readOnly}
						hideLabel
					/>
					{photoQuestion && (
						<ChecklistFormField
							question={photoQuestion}
							value={values[ids.maintenancePhoto]}
							onChange={(next) => onFieldChange(ids.maintenancePhoto, next)}
							error={errors[ids.maintenancePhoto]}
							readOnly={readOnly}
							required={false}
						/>
					)}
				</div>
			)}
		</div>
	);
}

function NotesSection({ formBinding, values, errors, onFieldChange, readOnly }) {
	const notesQuestion = formBinding.getQuestion(formBinding.CHECKLIST_IDS.notes);
	if (!notesQuestion) return null;

	return (
		<div className="card p-4 sm:p-5 space-y-4">
			<h2 className="text-sm font-semibold text-dark">Notes</h2>
			<ChecklistFormField
				question={notesQuestion}
				value={values[formBinding.CHECKLIST_IDS.notes]}
				onChange={(next) => onFieldChange(formBinding.CHECKLIST_IDS.notes, next)}
				error={errors[formBinding.CHECKLIST_IDS.notes]}
				readOnly={readOnly}
				hideLabel
			/>
		</div>
	);
}

export default function TurnCleanChecklistForm({
	formBinding = defaultFormBinding,
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
	const roomGroups = useMemo(() => formBinding.buildChecklistRoomGroups(), [formBinding]);
	const [values, setValues] = useState(() => formBinding.applyCalculations(initialValues));
	const [errors, setErrors] = useState({});
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState('');
	const [openRoomId, setOpenRoomId] = useState(roomGroups[0]?.id || null);
	const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
	const [autoSaveDetail, setAutoSaveDetail] = useState('');
	const [autoSaveTick, setAutoSaveTick] = useState(0);
	const skipAutoSaveRef = useRef(true);
	const autoSaveInFlightRef = useRef(false);
	const autoSaveQueuedRef = useRef(false);

	function syncValuesAfterPersist(prev, result) {
		const base = result?.syncedValues || prev;
		return formBinding.applyCalculations(applyUploadedFilesToValues(
			formBinding.applyCalculations(base),
			result?.uploadedFiles,
		));
	}

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
			setAutoSaveDetail('');
			const computed = formBinding.applyCalculations(values);
			try {
				const result = await onAutoSave({
					values: computed,
					answers: formBinding.serializeAnswers(computed),
					onProgress: ({ phase, done, total }) => {
						if (phase === 'upload' && total > 0) {
							setAutoSaveDetail(`Uploading photos (${done}/${total})…`);
						}
					},
				});
				setValues((prev) => syncValuesAfterPersist(prev, result));
				setAutoSaveStatus('saved');
				setAutoSaveDetail('');
			} catch {
				setAutoSaveStatus('error');
				setAutoSaveDetail('');
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
		setValues((prev) => formBinding.applyCalculations({ ...prev, [id]: next }));
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
			const result = await onSave({
				values: formBinding.applyCalculations(values),
				answers: formBinding.serializeAnswers(formBinding.applyCalculations(values)),
			});
			setValues((prev) => syncValuesAfterPersist(prev, result));
			setAutoSaveStatus('saved');
			setAutoSaveDetail('');
		} catch (err) {
			setSubmitError(err.message || 'Could not save form');
		}
	}

	function handleClear() {
		if (locked) return;
		if (!window.confirm('Clear all entered data and start over? Unsaved changes will be lost.')) return;
		skipAutoSaveRef.current = true;
		setValues(formBinding.applyCalculations(resetValues ?? initialValues));
		setErrors({});
		setSubmitError('');
		setAutoSaveStatus('idle');
		setOpenRoomId(roomGroups[0]?.id || null);
		onClear?.();
	}

	async function handleSubmit(e) {
		e.preventDefault();
		if (submitting) return;
		setSubmitError('');
		const nextErrors = formBinding.validateForm(values);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length) {
			const count = Object.keys(nextErrors).length;
			setSubmitError(
				count === 1
					? 'One required item still needs attention. Check the highlighted field below.'
					: `${count} required items still need attention. Check the highlighted fields below.`,
			);
			const firstKey = Object.keys(nextErrors)[0];
			const el = document.getElementById(`field-${firstKey}`) || document.querySelector(`[name="${firstKey}"]`);
			el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
			return;
		}

		setSubmitting(true);
		try {
			const result = await onSubmit({
				values: formBinding.applyCalculations(values),
				answers: formBinding.serializeAnswers(formBinding.applyCalculations(values)),
			});
			if (result?.syncedValues) {
				setValues(formBinding.applyCalculations(result.syncedValues));
			}
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
					formBinding={formBinding}
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
						formBinding={formBinding}
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

			<AdditionalChargesSection formBinding={formBinding} values={values} errors={errors} onFieldChange={onFieldChange} readOnly={locked} />
			<MaintenanceSection formBinding={formBinding} values={values} errors={errors} onFieldChange={onFieldChange} readOnly={locked} />
			<NotesSection formBinding={formBinding} values={values} errors={errors} onFieldChange={onFieldChange} readOnly={locked} />

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
											<span>{autoSaveDetail || 'Saving…'}</span>
										</>
									)}
									{autoSaveStatus === 'saved' && (
										<>
											<Cloud size={12} className="shrink-0 text-green-600" />
											<span className="text-green-700">Draft saved</span>
										</>
									)}
									{autoSaveStatus === 'error' && (
										<span>Save failed — check your connection</span>
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

