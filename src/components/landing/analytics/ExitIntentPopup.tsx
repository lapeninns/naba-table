'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

import { Icon } from '../shared/Icons';

export function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const shouldShow = !localStorage.getItem('exit-intent-dismissed');
    const timer = setTimeout(() => {
      if (shouldShow && !isVisible) {
        setIsVisible(true);
      }
    }, 30000);

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 50 && shouldShow && !isVisible) {
        setIsVisible(true);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('exit-intent-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
    >
      <div
        className="relative max-w-lg w-full mx-4 bg-white rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>

        <div className="space-y-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <Icon name="zap" className="h-6 w-6" />
          </div>

          <div>
            <h2 id="exit-intent-title" className="text-2xl font-bold text-slate-900 mb-2">
              Wait! Don&apos;t miss out on £150+ savings per night
            </h2>
            <p className="text-slate-600">
              See how other venues are eliminating no-shows and filling empty tables in just 24
              hours.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button
              size="lg"
              className="w-full h-12 text-base font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              asChild
            >
              <a href="/demo">Get Your Free Demo</a>
            </Button>
            <div className="flex items-center gap-2 justify-center text-sm text-slate-500">
              <Icon name="check" className="h-4 w-4 text-green-600" />
              <span>No credit card required</span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors text-center"
          >
            No thanks, I understand the value
          </button>
        </div>
      </div>
    </div>
  );
}
