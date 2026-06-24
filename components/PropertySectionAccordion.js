import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import SegmentedToggle from './SegmentedToggle';

const DROPDOWN_THRESHOLD = 4;

export default function PropertySectionAccordion({ sections, defaultKey }) {
	const visible = sections.filter((section) => section.visible !== false);
	const initialKey = visible.some((section) => section.key === defaultKey)
		? defaultKey
		: visible[0]?.key;
	const [active, setActive] = useState(initialKey || null);
	const [open, setOpen] = useState(false);

	if (!visible.length) return null;

	const activeSection = visible.find((section) => section.key === active);
	const useDropdown = visible.length > DROPDOWN_THRESHOLD;

	function selectSection(key) {
		setActive(key);
		setOpen(false);
	}

	return (
		<div className="card">
			<div className="sticky top-0 z-10 rounded-t-xl border-b border-border bg-white p-3">
				{useDropdown ? (
					<div className="relative">
						<button
							type="button"
							onClick={() => setOpen((v) => !v)}
							className="select-compact flex w-full items-center gap-2 text-left"
							aria-expanded={open}
							aria-haspopup="listbox"
						>
							<span className="min-w-0 flex-1 truncate font-medium text-dark">
								{activeSection?.label || 'Select section'}
							</span>
							{activeSection?.badge ? (
								<span className="shrink-0">{activeSection.badge}</span>
							) : null}
							<ChevronDown
								size={14}
								className={clsx(
									'shrink-0 text-muted transition-transform',
									open && 'rotate-180',
								)}
							/>
						</button>

						{open && (
							<>
								<button
									type="button"
									className="fixed inset-0 z-20"
									aria-label="Close section menu"
									onClick={() => setOpen(false)}
								/>
								<ul
									className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-lg"
									role="listbox"
									aria-label="Property sections"
								>
									{visible.map((section) => {
										const selected = section.key === active;
										return (
											<li key={section.key} role="option" aria-selected={selected}>
												<button
													type="button"
													onClick={() => selectSection(section.key)}
													className={clsx(
														'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
														selected
															? 'bg-brand-50 font-medium text-brand-700'
															: 'text-dark hover:bg-gray-50',
													)}
												>
													<span className="min-w-0 break-words">{section.label}</span>
													{section.badge}
												</button>
											</li>
										);
									})}
								</ul>
							</>
						)}
					</div>
				) : (
					<SegmentedToggle
						value={active}
						onChange={setActive}
						options={visible.map((section) => ({
							value: section.key,
							label: section.label,
						}))}
					/>
				)}
			</div>

			{activeSection && (
				<div className="min-w-0 overflow-x-hidden p-4">
					{activeSection.content}
				</div>
			)}
		</div>
	);
}
