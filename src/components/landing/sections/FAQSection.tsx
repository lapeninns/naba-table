'use client';

import { Icon } from '../shared/Icons';

const FAQ_ITEMS = [
  {
    question: 'The 90-Day No-Show Recovery Guarantee',
    answer:
      'If we don&apos;t recover at least 3x our fee in no-show or late-cancel revenue within 90 days, we work for free until we do.',
  },
  {
    question: 'The &quot;Anti-Guarantee&quot;',
    answer:
      'We have no long-term contracts. We have to earn your business every single month. If you hate making more money, you can leave at any time.',
  },
  {
    question: 'How does pricing work?',
    answer:
      'We abandoned the commodity model. We charge a one-time &quot;White Glove&quot; setup (£3k-£9k) and a monthly Profit-Engine fee (£299-£899).',
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-24 bg-slate-50 border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">
          Guarantees & Objections
        </h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <div
              key={item.question}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm motion-safe:reveal-up"
            >
              <h3 className="font-bold text-slate-900 mb-2 flex items-start gap-3">
                <span className="text-blue-600 mt-1">
                  <Icon name="arrowRight" className="w-4 h-4" />
                </span>
                {item.question}
              </h3>
              <p className="text-slate-600 text-sm ml-7">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
