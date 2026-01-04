'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { Icon } from '../shared/Icons';

const BENEFITS = [
  {
    title: 'The Core Engine',
    description:
      'Automated bookings and SMS confirmations. No-shows drop to near zero immediately.',
    value: '£5,000 Value',
    icon: 'check' as const,
  },
  {
    title: 'Sunday Roast Capacity Calc',
    description:
      'An algorithm that stops kitchen meltdowns by pacing covers perfectly during peak service.',
    value: '£1,500 Value',
    icon: 'clock' as const,
  },
  {
    title: 'No-Show Prevention Pack',
    description:
      'Deposit and card pre-auth templates designed specifically for UK legal standards.',
    value: '£1,000 Value',
    icon: 'shield' as const,
  },
  {
    title: 'Host Stand Playbook',
    description:
      '10-minute pre-shift checklist and scripts so staff stop "playing Tetris" with your floor.',
    value: '£2,000 Value',
    icon: 'user' as const,
  },
  {
    title: 'Whale-Watcher CRM',
    description:
      'Identify high-spenders instantly. Ensure VIPs get the treatment that drives 3x loyalty.',
    value: '£2,000 Value',
    icon: 'chart' as const,
  },
  {
    title: 'White Glove Migration',
    description:
      'We handle the entire tech switch from old systems or spreadsheets. You do zero work.',
    value: 'PRICELESS',
    icon: 'zap' as const,
  },
];

export function BenefitsSection() {
  return (
    <section id="features" className="py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4 motion-safe:reveal-up">
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 ring-1 ring-blue-700/10">
            The UK Pub Profit Stack
          </Badge>
          <h2 className="text-4xl font-bold text-slate-900">The Total Lockdown Bundle</h2>
          <p className="text-lg text-slate-600">
            Total Value: £12,500+ / Yours for less than a missed 4-top.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {BENEFITS.map((benefit, index) => {
            const isFeatured = index === BENEFITS.length - 1;
            return (
              <div
                key={benefit.title}
                className={cn(
                  'group p-6 rounded-2xl bg-slate-50 transition-all duration-200 ease-out border border-transparent hover:border-slate-100 hover:bg-white group-hover:-translate-y-2 group-hover:shadow-xl motion-safe:reveal-up',
                  isFeatured
                    ? 'md:col-span-2 lg:col-span-3 bg-gradient-to-r from-slate-50 to-blue-50 border-blue-100'
                    : '',
                )}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-white text-blue-600 rounded-xl shadow-sm flex items-center justify-center transition-all duration-200 ease-out group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 group-hover:scale-110">
                    <Icon name={benefit.icon} className="w-6 h-6" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      isFeatured
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/10'
                        : 'bg-slate-100 text-slate-600'
                    }
                  >
                    {benefit.value}
                  </Badge>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{benefit.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
