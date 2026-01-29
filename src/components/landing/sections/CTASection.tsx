'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="py-32 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-blue-600 opacity-[0.03] pattern-grid-lg" />
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10 motion-safe:reveal-up">
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">
          Ready to stop burning £150 per no-show?
        </h2>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          We&apos;ll show you exactly how to automate busy work and reclaim 20 hours of your week.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            size="lg"
            className="px-8 py-4 text-base bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
            variant="outline"
            asChild
          >
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-700 font-medium">
          Setup takes &lt; 24h. We handle heavy lifting.
        </p>
      </div>
    </section>
  );
}
