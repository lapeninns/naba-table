'use client';

import { useRef, useState, useEffect } from 'react';

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
    <div className="factory-card p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
      <div className="w-12 h-12 bg-blue-100 text-blue-900 rounded-full flex items-center justify-center mb-4">
        <Icon name={metric.icon} className="w-6 h-6" />
      </div>
      <div
        ref={ref}
        className="text-4xl font-extrabold text-slate-900 mb-1 font-variant-numeric tabular-nums transition-colors transition-transform"
      >
        {formatMetricValue(value)}
      </div>
      <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
        {metric.label}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 font-mono">
        {metric.detail}
      </div>
    </div>
  );
}
