import React from 'react';

import { GuestEmpty } from '@/components/guest/ui';

export type GuestEmptyStateProps = {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  icon?: React.ElementType | React.ReactNode;
};

export function GuestEmptyState({
  title,
  description,
  ctaLabel = 'Browse restaurants',
  ctaHref = '/restaurants',
  icon,
}: GuestEmptyStateProps) {
  const iconComponent = React.useMemo(() => {
    if (!icon) return undefined;

    // If caller passed a React element, wrap it in a function component.
    if (React.isValidElement(icon)) {
      return () => icon;
    }

    // ForwardRefExoticComponent (e.g., Lucide icons) appears as a function OR object with $$typeof.
    if (typeof icon === 'function') {
      return icon as React.ElementType;
    }

    return undefined;
  }, [icon]);

  return (
    <GuestEmpty
      title={title}
      description={description ?? ''}
      icon={iconComponent}
      actionLabel={ctaLabel}
      actionHref={ctaHref}
    />
  );
}
