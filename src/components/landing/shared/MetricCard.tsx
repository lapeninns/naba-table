'use client';

import { useRef, useState, useEffect } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { Icon } from './Icons';

type Metric = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  detail: string;
  icon: 'chart' | 'zap';
};

function useCountUp(endValue: number, duration: number, enabled: boolean) {
  const [value, setValue] = useState(0);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setValue(endValue);
      hasStartedRef.current = true;
      return;
    }
    setValue(0);
    hasStartedRef.current = false;
  }, [endValue, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const node = elementRef.current;
    if (!node) return undefined;

    let startTime: number | null = null;
    let animationFrame = 0;

    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const nextValue = Math.round(progress * endValue);
      setValue(progress === 1 ? endValue : nextValue);
      if (progress < 1) animationFrame = window.requestAnimationFrame(step);
    };

    const start = () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      animationFrame = window.requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            start();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [duration, enabled, endValue]);

  return { ref: elementRef, value };
}

interface MetricCardProps {
  metric: Metric;
  reduceMotion: boolean;
}

export function MetricCard({ metric, reduceMotion }: MetricCardProps) {
  const { ref, value } = useCountUp(metric.value, 1200, !reduceMotion);

  function formatMetricValue(val: number) {
    const formatted = val.toLocaleString('en-GB');
    return `${metric.prefix ?? ''}${formatted}${metric.suffix ?? ''}`;
  }

  return (
    <Card
      variant="compact"
      className="pg-panel overflow-hidden border-primary/15 bg-background/95 shadow-[var(--pg-shadow-xs)] transition-all duration-200"
    >
      <CardHeader className="flex flex-col gap-0 space-y-0 border-b border-border/60 bg-muted/35 p-4 sm:p-5 md:p-6">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary sm:mb-4">
          <Icon name={metric.icon} className="size-6" />
        </div>
        <div
          ref={ref}
          className="font-variant-numeric font-[var(--pg-font-mono)] text-3xl font-bold tabular-nums text-foreground transition-colors sm:text-4xl"
        >
          {formatMetricValue(value)}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          {metric.label}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5 md:p-6">
        <Separator />
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {metric.detail}
        </p>
      </CardContent>
    </Card>
  );
}
