import Image from 'next/image';

import { cn } from '@/lib/utils';

type BrandIconSize = 'sm' | 'md' | 'lg';

type BrandIconProps = {
  size?: BrandIconSize;
  className?: string;
  animated?: boolean;
};

const sizeClassMap: Record<BrandIconSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16 sm:h-20 sm:w-20',
};

const sizePxMap: Record<BrandIconSize, number> = {
  sm: 32,
  md: 40,
  lg: 80,
};

export function BrandIcon({ size = 'md', className, animated = false }: BrandIconProps) {
  const logoSrc = animated ? '/brand/nabatable-logo-animated.svg' : '/brand/nabatable-logo.svg';

  return (
    <Image
      src={logoSrc}
      alt="Nabatable logo"
      width={sizePxMap[size]}
      height={sizePxMap[size]}
      className={cn('inline-block', sizeClassMap[size], className)}
      priority
    />
  );
}
