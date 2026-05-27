import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';

const ICON = '/logo-icon.png';
const HORIZONTAL = '/logo.png';

export function BrandLogo({
  variant = 'sidebar',
  href,
  title,
  className,
  onClick,
}) {
  const inner = (() => {
    if (variant === 'login') {
      return (
        <div className={clsx('text-center', className)}>
          <div className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-4 mb-4 shadow-lg">
            <Image
              src={HORIZONTAL}
              alt="Hello Neighbor Real Estate Group"
              width={280}
              height={46}
              priority
              className="h-10 w-auto"
            />
          </div>
          <p className="text-brand-300 text-sm">Real Estate Group · Operations</p>
        </div>
      );
    }

    if (variant === 'header') {
      return (
        <div className={clsx('flex items-center gap-2 min-w-0', className)}>
          <Image
            src={ICON}
            alt=""
            width={24}
            height={24}
            className="w-6 h-6 rounded flex-shrink-0"
          />
          <span className="font-semibold text-dark text-sm truncate">
            {title || 'Hello Neighbor'}
          </span>
        </div>
      );
    }

    return (
      <div className={clsx('flex items-center gap-2.5 min-w-0', className)}>
        <Image
          src={ICON}
          alt=""
          width={32}
          height={32}
          className="w-8 h-8 rounded-md flex-shrink-0 shadow-sm"
        />
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">
            Hello Neighbor
          </p>
          <p className="text-brand-300 text-xs truncate">Real Estate Group</p>
        </div>
      </div>
    );
  })();

  if (href) {
    return (
      <Link href={href} onClick={onClick} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
