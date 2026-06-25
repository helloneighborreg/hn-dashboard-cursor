import clsx from 'clsx';

const VARIANTS = {
  accepted:    'bg-green-100 text-green-800',
  active:      'bg-green-100 text-green-800',
  cancelled:   'bg-red-100 text-red-700',
  canceled:    'bg-red-100 text-red-700',
  expired:     'bg-red-100 text-red-700',
  pending:     'bg-amber-100 text-amber-800',
  inquiry:     'bg-blue-100 text-blue-800',
  unassigned:  'bg-gray-100 text-gray-600',
  assigned:    'bg-brand-100 text-brand-700',
  hold:        'bg-orange-100 text-orange-800',
  completed:   'bg-green-100 text-green-700',
  overdue:     'bg-red-100 text-red-700',
  airbnb:      'bg-rose-100 text-rose-700',
  homeaway:    'bg-blue-100 text-blue-700',
  vrbo:        'bg-blue-100 text-blue-700',
  direct:      'bg-purple-100 text-purple-700',
  default:     'bg-gray-100 text-gray-600',
};

export default function Badge({ label, variant }) {
  const cls = VARIANTS[variant?.toLowerCase()] || VARIANTS.default;
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      {label}
    </span>
  );
}
