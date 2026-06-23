import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export default function PropertySectionAccordion({ sections, defaultKey }) {
	const visible = sections.filter((section) => section.visible !== false);
	const initialKey = visible.some((section) => section.key === defaultKey)
		? defaultKey
		: visible[0]?.key;
	const [active, setActive] = useState(initialKey || null);

	if (!visible.length) return null;

	const activeSection = visible.find((section) => section.key === active);

	return (
		<div className="card">
			<div className="sticky top-0 z-10 bg-white divide-y divide-border">
				{visible.map((section) => {
					const isOpen = active === section.key;
					return (
						<button
							key={section.key}
							type="button"
							onClick={() => setActive(isOpen ? null : section.key)}
							className={clsx(
								'flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors',
								isOpen ? 'bg-brand-50/60' : 'hover:bg-gray-50',
							)}
							aria-expanded={isOpen}
						>
							<span className="text-sm font-medium text-dark min-w-0 break-words">{section.label}</span>
							<div className="flex items-center gap-2 shrink-0">
								{section.badge}
								<ChevronDown
									size={16}
									className={clsx(
										'text-muted transition-transform',
										isOpen && 'rotate-180',
									)}
								/>
							</div>
						</button>
					);
				})}
			</div>
			{activeSection && (
				<div className="px-4 pb-4 pt-1 border-t border-border/60 bg-white min-w-0 overflow-x-hidden">
					{activeSection.content}
				</div>
			)}
		</div>
	);
}
