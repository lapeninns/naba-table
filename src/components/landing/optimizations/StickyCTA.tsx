'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';

import { Icon } from '../shared/Icons';

export function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.getElementById('hero');
      const footerSection = document.querySelector('footer');
      const heroBottom = heroSection ? heroSection.getBoundingClientRect().bottom : 0;
      const footerTop = footerSection ? footerSection.getBoundingClientRect().top : 0;
      const viewportHeight = window.innerHeight;

      const shouldShow = heroBottom < 0 && footerTop > viewportHeight;
      setIsVisible(shouldShow);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isVisible || isHidden) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 bg-white rounded-full shadow-lg border border-slate-200 p-1 pr-2">
        <Button
          size="lg"
          className="rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
          asChild
        >
          <a href="/demo">
            <Icon name="arrowRight" className="mr-2 h-4 w-4" />
            Get A Demo
          </a>
        </Button>
        <button
          onClick={() => setIsHidden(true)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
          aria-label="Close sticky CTA"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
