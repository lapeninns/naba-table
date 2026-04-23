import Link from 'next/link';

import { cn } from '@/lib/utils';

import { BrandIcon } from './BrandIcon';

interface BrandLogoProps {
  href?: string;
  className?: string;
  showBeta?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  animated?: boolean;
}

export function BrandLogo({
  href = '/',
  className,
  showBeta = true,
  size = 'md',
  variant = 'light',
  animated = false,
}: BrandLogoProps) {
  const textColor = variant === 'dark' ? 'text-white' : 'text-slate-900';
  const betaBg =
    variant === 'dark'
      ? 'bg-blue-600/20 border-blue-500/30 text-blue-100'
      : 'bg-blue-50 border-blue-100 text-blue-700';

  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 transition-opacity hover:opacity-80', className)}
    >
      <BrandIcon
        size={size === 'lg' ? 'md' : 'sm'}
        className="shrink-0 transition-transform duration-200 ease-out hover:rotate-3"
        animated={animated}
      />
      <div className="relative flex items-center">
        <span
          className={cn(
            'font-bold tracking-tight whitespace-nowrap',
            size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : 'text-xl',
            textColor,
          )}
        >
          Nabatable
        </span>
        {showBeta && (
          <span
            className={cn(
              'absolute -top-3 right-0 sm:-right-10 -rotate-12 text-[10px] font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-full whitespace-nowrap border shadow-sm',
              betaBg,
            )}
          >
            ^ beta
          </span>
        )}
      </div>
    </Link>
  );
}
