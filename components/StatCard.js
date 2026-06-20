import Link from 'next/link';
import clsx from 'clsx';

export default function StatCard({ label, value, sub, icon: Icon, color = 'brand', onClick, href, className }) {
  const colors = {
    brand:  { bg: 'bg-brand-50',   icon: 'text-brand-500',  border: 'border-brand-100' },
    green:  { bg: 'bg-green-50',   icon: 'text-green-600',  border: 'border-green-100' },
    amber:  { bg: 'bg-amber-50',   icon: 'text-amber-600',  border: 'border-amber-100' },
    blue:   { bg: 'bg-blue-50',    icon: 'text-blue-600',   border: 'border-blue-100' },
    red:    { bg: 'bg-red-50',     icon: 'text-red-500',    border: 'border-red-100' },
    purple: { bg: 'bg-purple-50',  icon: 'text-purple-600', border: 'border-purple-100' },
  };
  const c = colors[color] || colors.brand;
  const interactive = Boolean(onClick || href);

  const card = (
    <div
      onClick={onClick}
      className={clsx(
        // Compact, near-square widgets on mobile; roomier on larger screens.
        'bg-white rounded-xl border border-border shadow-card p-3 sm:p-5 flex items-start gap-3 sm:gap-4 w-full min-w-0 h-full min-h-[6.5rem] sm:min-h-[7.5rem]',
        interactive && 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150',
        className,
      )}
    >
      {Icon && (
        <div className={clsx('p-2 rounded-lg flex-shrink-0', c.bg)}>
          <Icon size={18} className={c.icon} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-dark mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {card}
      </Link>
    );
  }

  return card;
}
