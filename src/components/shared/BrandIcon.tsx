import { useId } from 'react';

import { cn } from '@/lib/utils';

type BrandIconSize = 'sm' | 'md' | 'lg';

type BrandIconProps = {
  size?: BrandIconSize;
  className?: string;
};

const sizeClassMap: Record<BrandIconSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16 sm:h-20 sm:w-20',
};

const PIN_PATH =
  'M256 32C150 32 64 118 64 224c0 85 60 180 176 252a32 32 0 0 0 32 0c116-72 176-167 176-252C448 118 362 32 256 32z';
const TABLE_PATH =
  'M166 160H346V195H166Z M186 195H216V290H186Z M296 195H326V290H296Z M216 195L296 290H260L195 210V195Z';

export function BrandIcon({ size = 'md', className }: BrandIconProps) {
  const uniqueId = useId();
  const pinGradientId = `${uniqueId}-pinGradient`;
  const textGradientId = `${uniqueId}-textGradient`;
  const dropShadowId = `${uniqueId}-dropShadow`;
  const innerShadowId = `${uniqueId}-innerShadow`;

  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn('inline-block', sizeClassMap[size], className)}
    >
      <defs>
        <linearGradient
          id={pinGradientId}
          x1="0"
          y1="0"
          x2="512"
          y2="512"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient
          id={textGradientId}
          x1="150"
          y1="150"
          x2="350"
          y2="350"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <filter id={dropShadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1E3A8A" floodOpacity="0.35" />
        </filter>
        <filter id={innerShadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feComponentTransfer in="SourceAlpha">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          <feGaussianBlur stdDeviation="5" />
          <feOffset dx="0" dy="5" result="offsetblur" />
          <feFlood floodColor="black" floodOpacity="0.2" />
          <feComposite in2="offsetblur" operator="in" />
          <feComposite in2="SourceAlpha" operator="in" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode />
          </feMerge>
        </filter>
      </defs>

      <path d={PIN_PATH} fill={`url(#${pinGradientId})`} filter={`url(#${dropShadowId})`} />
      <circle cx="256" cy="224" r="110" fill="white" />
      <path d={TABLE_PATH} fill={`url(#${textGradientId})`} filter={`url(#${innerShadowId})`} />
    </svg>
  );
}
