import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export default function PropertySectionAccordion({ sections, defaultKey, className, stickyHeaders = false }) {
	const visible = sections.filter((section) => section.visible !== false);
	const initialKey = visible.some((section) => section.key === defaultKey)
		? defaultKey
		: visible[0]?.key;
	const [active, setActive] = useState(initialKey || null);

	if (!visible.length) return null;

	return (
		<div className={clsx('card divide-y divide-border', className || 'overflow-hidden')}>
			{visible.map((section) => {
				const isOpen = active === section.key;
				return (
					<div key={section.key}>
						<button
							type="button"
							onClick={() => setActive(isOpen ? null : section.key)}
							className={clsx(
								'flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors',
								isOpen ? 'bg-brand-50/60' : 'hover:bg-gray-50',
								stickyHeaders && 'sticky top-0 z-[1] bg-white shadow-[0_1px_0_theme(colors.border)]',
								stickyHeaders && isOpen && 'bg-brand-50/60',
							)}
							aria-expanded={isOpen}
						>
							<span className="text-sm font-medium text-dark min-w-0 break-words">{section.label}</span>
							<div className="flex items-center gap-2 shrink-0">
								{section.badge}
								<ChevronDown
									size={16}
									className={clsx(
										'text-muted transition-transform duration-200',
										isOpen && 'rotate-180',
									)}
								/>
							</div>
						</button>
						{isOpen && (
							<div className="px-4 pb-4 pt-1 border-t border-border/60 bg-white min-w-0 overflow-x-hidden">
								{section.content}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
