'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { ClarityProvider } from './analytics/ClarityProvider';
import { LazySection } from './optimizations';
import {
  HeroSection,
  ProblemSection,
  MetricsSection,
  BenefitsSection,
  HowItWorksSection,
  TestimonialsSection,
  FAQSection,
  CTASection,
} from './sections';
import { SchemaOrg } from './seo';
import { Navbar, Footer } from './shared';

interface LandingPageProps {
  isAuthenticated: boolean;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);
    const listener = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return prefersReducedMotion;
}

function AnimationObserver() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('active');
        });
      },
      { threshold: 0.1 },
    );

    document.querySelectorAll('.motion-safe\\:reveal-up').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });
  return null;
}

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={cn(
        'relative min-h-[100dvh] font-sans selection:bg-primary/15 selection:text-foreground',
        prefersReducedMotion ? '' : '',
      )}
    >
      <SchemaOrg />
      <ClarityProvider />
      {prefersReducedMotion ? null : <AnimationObserver />}

      <Navbar isAuthenticated={isAuthenticated} />

      <main id="main-content">
        <HeroSection reduceMotion={prefersReducedMotion} />
        <ProblemSection />
        <MetricsSection reduceMotion={prefersReducedMotion} />
        <LazySection>
          <BenefitsSection />
        </LazySection>
        <LazySection>
          <HowItWorksSection />
        </LazySection>
        <LazySection>
          <TestimonialsSection />
        </LazySection>
        <LazySection>
          <FAQSection />
        </LazySection>
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
