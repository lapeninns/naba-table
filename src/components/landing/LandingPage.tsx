'use client';

import { useEffect, useState } from 'react';

import { LazySection } from './optimizations';
import {
  HeroSection,
  ProblemSection,
  MetricsSection,
  BenefitsSection,
  HowItWorksSection,
  TestimonialsSection,
  GuaranteeSection,
  FAQSection,
  CTASection,
} from './sections';
import { SchemaOrg } from './seo';
import { Footer, Navbar } from './shared';

interface LandingPageProps {
  isAuthenticated: boolean;
}

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="pg-page flex min-h-[100dvh] flex-col">
      <SchemaOrg />
      <Navbar isAuthenticated={isAuthenticated} />

      <main id="main-content" className="flex-1">
        <HeroSection />

        <LazySection>
          <ProblemSection />
        </LazySection>

        <LazySection>
          <MetricsSection reduceMotion={reduceMotion} />
        </LazySection>

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
          <GuaranteeSection />
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
