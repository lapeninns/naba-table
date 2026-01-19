'use client';

import { useInView } from 'react-intersection-observer';

interface LazySectionProps {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  fallback?: React.ReactNode;
  className?: string;
}

export function LazySection({
  children,
  threshold = 0.1,
  rootMargin = '200px',
  fallback = null,
  className = '',
}: LazySectionProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold,
    rootMargin,
  });

  if (!inView) {
    return (
      <div ref={ref} className={className}>
        {fallback}
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
