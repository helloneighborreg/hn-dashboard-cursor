import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, CheckCircle2, Cloud, Loader2 } from 'lucide-react';
import ChecklistFormField from './ChecklistFormField';
import {
	CJC_TURN_CLEAN_FORM,
	HEADER_QUESTION_IDS,
	FOOTER_QUESTION_IDS,
	HIDDEN_FOOTER_QUESTION_IDS,
	buildChecklistSections,
	getQuestion,
	applyCalculations,
	validateForm,
	serializeAnswers,
} from '../../lib/forms/cjcTurnCleanChecklist';
import { stripUploadedBase64 } from '../../lib/forms/checklistSubmitClient';

const AUTO_SAVE_DELAY_MS = 2500;

function HeaderFieldGrid({ values, errors, onFieldChange, readOnly }) {
	const headerQuestions = CJC_TURN_CLEAN_FORM.questions.filter((q) => HEADER_QUESTION_IDS.has(q.id));
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{headerQuestions.map((q) => (
				<div key={q.id} className={q.type === 'FileUpload' ? 'sm:col-span-2' : ''}>
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

function SectionAccordion({ section, index, values, errors, onFieldChange, open, onToggle, readOnly }) {
	const complete = (!section.checklist || !errors[section.checklist.id])
		&& (!section.photo || !errors[section.photo.id]);

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
				<span className="flex-1 font-medium text-sm text-dark">{section.title}</span>
				<ChevronDown size={16} className={clsx('text-muted transition-transform', open && 'rotate-180')} />
			</button>
			{open && (
				<div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
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
			)}
		</div>
	);
}

function FooterFields({ values, errors, onFieldChange, readOnly }) {
	const footerQuestions = CJC_TURN_CLEAN_FORM.questions.filter(
		(q) => FOOTER_QUESTION_IDS.has(q.id) && !HIDDEN_FOOTER_QUESTION_IDS.has(q.id),
	);
	const showAdditional = values['kmJc'] === 'Yes';

	return (
		<div className="card p-4 sm:p-5 space-y-4">
			<h2 className="text-sm font-semibold text-dark">Other</h2>
			{footerQuestions.map((q) => {
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

export default function CjcTurnCleanChecklistForm({
	initialValues,
	resetValues,
	onSubmit,
	onSave,
	onAutoSave,
	onClear,
	submitLabel = 'Submit checklist',
	locked = false,
	saving = false,
	saveMessage = '',
}) {
	const sections = useMemo(() => buildChecklistSections(), []);
	const [values, setValues] = useState(() => applyCalculations(initialValues));
	const [errors, setErrors] = useState({});
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState('');
	const [openSectionId, setOpenSectionId] = useState(sections[0]?.id || null);
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
		setOpenSectionId(sections[0]?.id || null);
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
					<h2 className="text-sm font-semibold text-dark">Job details</h2>
					<p className="text-xs text-muted mt-1">Prefilled from the task when opened from Tasks. Changes auto-save as you go.</p>
				</div>
				<HeaderFieldGrid
					values={values}
					errors={errors}
					onFieldChange={onFieldChange}
					readOnly={locked}
				/>
			</div>

			<div className="space-y-3">
				<h2 className="text-sm font-semibold text-dark px-1">Room checklist</h2>
				{sections.map((section, index) => (
					<SectionAccordion
						key={section.id}
						section={section}
						index={index}
						values={values}
						errors={errors}
						onFieldChange={onFieldChange}
						open={openSectionId === section.id}
						onToggle={() => setOpenSectionId((cur) => (cur === section.id ? null : section.id))}
						readOnly={locked}
					/>
				))}
			</div>

			<FooterFields values={values} errors={errors} onFieldChange={onFieldChange} readOnly={locked} />

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
