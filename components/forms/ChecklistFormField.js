import clsx from 'clsx';
import DateInput from '../DateInput';
import CameraCaptureField from './CameraCaptureField';

function FieldError({ message }) {
	if (!message) return null;
	return <p className="text-xs text-red-600 mt-1">{message}</p>;
}

function CheckboxGroup({ question, value, onChange, error, readOnly }) {
	const selected = new Set(Array.isArray(value) ? value : []);

	function toggle(optionValue) {
		if (readOnly) return;
		const next = new Set(selected);
		if (next.has(optionValue)) next.delete(optionValue);
		else next.add(optionValue);
		onChange([...next]);
	}

	return (
		<div>
			<p className="text-sm font-medium text-dark mb-2">{question.name}</p>
			<ul className={clsx('space-y-2', error && 'rounded-lg ring-1 ring-red-300 p-2')}>
				{(question.options || []).map((opt) => {
					const checked = selected.has(opt.value);
					return (
						<li key={opt.id}>
							<label className={clsx(
								'flex items-start gap-3 group',
								readOnly ? 'cursor-default' : 'cursor-pointer',
							)}>
								<input
									type="checkbox"
									checked={checked}
									onChange={() => toggle(opt.value)}
									disabled={readOnly}
									className="mt-1 h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500 disabled:opacity-70"
								/>
								<span className="text-sm text-dark group-hover:text-brand-700 leading-snug">{opt.label}</span>
							</label>
						</li>
					);
				})}
			</ul>
			<FieldError message={error} />
		</div>
	);
}

function RadioGroup({ question, value, onChange, error, readOnly }) {
	return (
		<div>
			<p className="text-sm font-medium text-dark mb-2">{question.name}</p>
			<div className={clsx('flex flex-wrap gap-3', error && 'rounded-lg ring-1 ring-red-300 p-2')}>
				{(question.options || []).map((opt) => (
					<label key={opt.id} className={clsx(
						'inline-flex items-center gap-2',
						readOnly ? 'cursor-default' : 'cursor-pointer',
					)}>
						<input
							type="radio"
							name={question.id}
							checked={value === opt.value}
							onChange={() => onChange(opt.value)}
							disabled={readOnly}
							className="h-4 w-4 border-border text-brand-500 focus:ring-brand-500 disabled:opacity-70"
						/>
						<span className="text-sm text-dark">{opt.label}</span>
					</label>
				))}
			</div>
			<FieldError message={error} />
		</div>
	);
}

export default function ChecklistFormField({
	question,
	value,
	onChange,
	error,
	readOnly = false,
	required,
	hideLabel = false,
}) {
	if (!question) return null;
	const id = `field-${question.id}`;

	if (question.type === 'Checkboxes') {
		return (
			<CheckboxGroup
				question={question}
				value={value}
				onChange={onChange}
				error={error}
				readOnly={readOnly}
			/>
		);
	}

	if (question.type === 'MultipleChoice') {
		return (
			<RadioGroup
				question={question}
				value={value}
				onChange={onChange}
				error={error}
				readOnly={readOnly}
			/>
		);
	}

	if (question.type === 'FileUpload') {
		return (
			<CameraCaptureField
				id={id}
				label={question.name}
				value={value}
				onChange={onChange}
				error={error}
				required={required !== false}
				readOnly={readOnly}
			/>
		);
	}

	if (question.type === 'LongAnswer') {
		return (
			<div>
				{!hideLabel && <label className="label" htmlFor={id}>{question.name}</label>}
				<textarea
					id={id}
					rows={4}
					className={clsx('input resize-y min-h-[96px]', error && 'border-red-300')}
					value={value || ''}
					onChange={(e) => onChange(e.target.value)}
					readOnly={readOnly}
				/>
				<FieldError message={error} />
			</div>
		);
	}

	if (question.type === 'NumberInput') {
		return (
			<div>
				<label className="label" htmlFor={id}>{question.name}</label>
				<input
					id={id}
					type="number"
					min="0"
					step="0.01"
					className={clsx('input', error && 'border-red-300')}
					value={value ?? ''}
					onChange={(e) => onChange(e.target.value)}
					readOnly={readOnly}
				/>
				<FieldError message={error} />
			</div>
		);
	}

	if (question.type === 'DatePicker') {
		return (
			<div>
				<label className="label" htmlFor={id}>{question.name}</label>
				<DateInput
					id={id}
					value={value || ''}
					onChange={(e) => onChange(e.target.value)}
					className={clsx('input', error && 'border-red-300')}
					readOnly={readOnly}
				/>
				<FieldError message={error} />
			</div>
		);
	}

	if (question.type === 'Dropdown') {
		return (
			<div>
				<label className="label" htmlFor={id}>{question.name}</label>
				<select
					id={id}
					className={clsx('select', error && 'border-red-300')}
					value={value || ''}
					onChange={(e) => onChange(e.target.value)}
					disabled={readOnly}
				>
					<option value="">Select…</option>
					{(question.options || []).map((opt) => (
						<option key={opt.id} value={opt.value}>{opt.label}</option>
					))}
				</select>
				<FieldError message={error} />
			</div>
		);
	}

	// ShortAnswer default
	return (
		<div>
			<label className="label" htmlFor={id}>{question.name}</label>
			<input
				id={id}
				type="text"
				className={clsx('input', error && 'border-red-300')}
				value={value || ''}
				onChange={(e) => onChange(e.target.value)}
				readOnly={readOnly}
			/>
			<FieldError message={error} />
		</div>
	);
}
