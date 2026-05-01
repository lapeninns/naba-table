'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const Iframe = React.forwardRef<HTMLIFrameElement, React.IframeHTMLAttributes<HTMLIFrameElement>>(
  ({ className, ...props }, ref) => (
    <iframe ref={ref} className={cn('bg-background', className)} {...props} />
  ),
);
Iframe.displayName = 'Iframe';

export { Iframe };
