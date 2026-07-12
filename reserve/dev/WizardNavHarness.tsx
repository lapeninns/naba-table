import * as React from 'react';

import { variantEntry, VARIANTS, type VariantKey } from './variants';

import type { SummaryFact } from './variants/shared';
import type { StepAction } from '../features/reservations/wizard/model/reducer';
import type {
  WizardStepMeta,
  WizardSummary,
} from '../features/reservations/wizard/ui/WizardProgress';

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO MODEL
// ═══════════════════════════════════════════════════════════════════════════

export type ScenarioKey = 'plan' | 'details' | 'review' | 'confirmation';

export const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: 'plan', label: 'Plan' },
  { key: 'details', label: 'Details' },
  { key: 'review', label: 'Review' },
  { key: 'confirmation', label: 'Confirmation' },
];

const STEPS: WizardStepMeta[] = [
  { id: 1, label: 'Plan', helper: 'Date & time' },
  { id: 2, label: 'Details', helper: 'Contact info' },
  { id: 3, label: 'Review', helper: 'Confirm' },
  { id: 4, label: 'Done', helper: 'Status' },
];

const noop = () => {};

interface BuiltScenario {
  currentStep: number;
  summary: WizardSummary;
  actions: StepAction[];
  facts: SummaryFact[];
}

interface ScenarioOptions {
  loading: boolean;
  long: boolean;
}

function withLoading(actions: StepAction[], loading: boolean): StepAction[] {
  if (!loading) return actions;
  return actions.map((action) =>
    action.role === 'primary' ? { ...action, loading: true, disabled: true } : action,
  );
}

export function buildScenario(key: ScenarioKey, { loading, long }: ScenarioOptions): BuiltScenario {
  const detailSummary: WizardSummary = long
    ? {
        primary: 'Wednesday, December 24',
        details: ['7:00 PM', '8 guests', 'Window booth · high chair · birthday'],
        srLabel: 'Christmas Eve dinner at 7 PM for eight guests, window booth',
      }
    : {
        primary: 'Tuesday, Mar 15',
        details: ['7:00 PM', '2 guests', 'Inside seating'],
        srLabel: 'Dinner on March 15 at 7 PM for two guests, inside seating',
      };

  const detailFacts: SummaryFact[] = [
    { label: 'Date', value: detailSummary.primary },
    { label: 'Time', value: detailSummary.details?.[0] ?? '' },
    { label: 'Party', value: detailSummary.details?.[1] ?? '' },
    { label: long ? 'Seating & notes' : 'Seating', value: detailSummary.details?.[2] ?? '' },
  ].filter((f) => f.value);

  switch (key) {
    case 'plan':
      return {
        currentStep: 1,
        summary: {
          primary: 'Select a date & time',
          details: long ? ['8 guests'] : ['2 guests'],
          srLabel: 'Choose a date and time to continue',
        },
        facts: [{ label: 'Party', value: long ? '8 guests' : '2 guests' }],
        actions: withLoading(
          [
            {
              id: 'continue',
              label: 'Continue',
              icon: 'ChevronRight',
              role: 'primary',
              onClick: noop,
            },
          ],
          loading,
        ),
      };

    case 'details':
      return {
        currentStep: 2,
        summary: detailSummary,
        facts: detailFacts,
        actions: withLoading(
          [
            { id: 'back', label: 'Back', variant: 'outline', role: 'secondary', onClick: noop },
            {
              id: 'continue',
              label: 'Continue',
              icon: 'ChevronRight',
              role: 'primary',
              onClick: noop,
            },
          ],
          loading,
        ),
      };

    case 'review':
      return {
        currentStep: 3,
        summary: detailSummary,
        facts: detailFacts,
        actions: withLoading(
          [
            { id: 'back', label: 'Back', variant: 'outline', role: 'secondary', onClick: noop },
            {
              id: 'confirm',
              label: loading ? 'Confirming…' : 'Confirm booking',
              icon: 'Check',
              role: 'primary',
              onClick: noop,
            },
          ],
          loading,
        ),
      };

    case 'confirmation':
      return {
        currentStep: 4,
        summary: {
          primary: '✓ Confirmed · Tue, Mar 15 at 7:00 PM',
          details: ['Reference Q8H42', '2 guests'],
          srLabel: 'Booking confirmed for March 15 at 7 PM, two guests, reference Q8H42',
        },
        facts: [
          { label: 'Reference', value: 'Q8H42' },
          { label: 'When', value: 'Tue, Mar 15 · 7:00 PM' },
          { label: 'Party', value: '2 guests' },
        ],
        actions: [
          {
            id: 'close',
            label: 'Close',
            icon: 'X',
            variant: 'ghost',
            role: 'secondary',
            onClick: noop,
          },
          {
            id: 'calendar',
            label: 'Add to calendar',
            icon: 'Calendar',
            variant: 'outline',
            role: 'support',
            onClick: noop,
          },
          {
            id: 'wallet',
            label: 'Add to wallet',
            icon: 'Wallet',
            variant: 'outline',
            role: 'support',
            onClick: noop,
          },
          { id: 'new', label: 'New reservation', icon: 'Plus', role: 'primary', onClick: noop },
        ],
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAME SCENE (rendered inside each iframe → owns its own viewport width)
// ═══════════════════════════════════════════════════════════════════════════

export interface FrameParams {
  scenario: ScenarioKey;
  variant: VariantKey;
  dark: boolean;
  loading: boolean;
  long: boolean;
}

export function readFrameParams(params: URLSearchParams): FrameParams {
  const scenario = (params.get('scenario') as ScenarioKey) || 'details';
  const variant = (params.get('variant') as VariantKey) || 'c';
  return {
    scenario: SCENARIOS.some((s) => s.key === scenario) ? scenario : 'details',
    variant: VARIANTS.some((v) => v.key === variant) ? variant : 'c',
    dark: params.get('dark') === '1',
    loading: params.get('loading') === '1',
    long: params.get('long') === '1',
  };
}

function FauxWizardBody({ scenario, badge }: { scenario: ScenarioKey; badge: string }) {
  const titleMap: Record<ScenarioKey, { eyebrow: string; title: string; blurb: string }> = {
    plan: {
      eyebrow: 'Step 1',
      title: 'When would you like to dine?',
      blurb: 'Pick a date, party size and service.',
    },
    details: {
      eyebrow: 'Step 2',
      title: 'Your details',
      blurb: 'We only use these to hold and confirm your table.',
    },
    review: {
      eyebrow: 'Step 3',
      title: 'Review your booking',
      blurb: 'Check everything looks right before we send it.',
    },
    confirmation: {
      eyebrow: 'All set',
      title: "You're booked in",
      blurb: 'A confirmation is on its way to your inbox.',
    },
  };
  const meta = titleMap[scenario];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-wide text-[color:var(--pg-text)]">
          The Nabatable
        </span>
        <span className="rounded-full border border-[color:var(--pg-border)] bg-[color:var(--pg-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--pg-action)]">
          {badge}
        </span>
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--pg-action)]">
          {meta.eyebrow}
        </span>
        <h1 className="text-2xl font-semibold text-[color:var(--pg-text)]">{meta.title}</h1>
        <p className="text-sm text-[color:var(--pg-text-muted)]">{meta.blurb}</p>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: scenario === 'confirmation' ? 2 : 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--pg-radius-lg)] border border-[color:var(--pg-border)] bg-[color:var(--pg-surface)] p-4 shadow-[var(--pg-shadow-xs)]"
          >
            <div className="mb-2 h-3 w-1/3 rounded-full bg-[color:var(--pg-border)]" />
            <div className="h-2.5 w-2/3 rounded-full bg-[color:var(--pg-border)] opacity-70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FrameScene({ scenario, variant, dark, loading, long }: FrameParams) {
  const [navHeight, setNavHeight] = React.useState(112);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const entry = variantEntry(variant);
  const Nav = entry.Component;
  const built = React.useMemo(
    () => buildScenario(scenario, { loading, long }),
    [scenario, loading, long],
  );

  return (
    <div className="pg-page min-h-[100dvh]">
      <div className="mx-auto w-full max-w-xl px-4 pt-5" style={{ paddingBottom: navHeight + 32 }}>
        <FauxWizardBody scenario={scenario} badge={entry.label} />
      </div>

      <Nav
        steps={STEPS}
        currentStep={built.currentStep}
        summary={built.summary}
        actions={built.actions}
        facts={built.facts}
        onHeightChange={(h) => {
          if (h) setNavHeight(h);
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL SHELL
// ═══════════════════════════════════════════════════════════════════════════

interface Device {
  label: string;
  note: string;
  w: number;
  h: number;
}

const PHONE_TABLET: Device[] = [
  { label: '320', note: 'iPhone SE · small Android', w: 320, h: 720 },
  { label: '360', note: 'common Android', w: 360, h: 740 },
  { label: '390', note: 'iPhone 14/15', w: 390, h: 780 },
  { label: '768', note: 'tablet portrait', w: 768, h: 700 },
];

const DESKTOP: Device = { label: '1180', note: 'desktop', w: 1180, h: 560 };
const COMPARE: Device = { label: '390', note: '', w: 390, h: 760 };

interface ShellState {
  scenario: ScenarioKey;
  variant: VariantKey;
  dark: boolean;
  loading: boolean;
  long: boolean;
}

function frameSrc(state: ShellState, override?: Partial<ShellState>): string {
  const s = { ...state, ...override };
  return `harness.html?${new URLSearchParams({
    frame: '1',
    scenario: s.scenario,
    variant: s.variant,
    dark: s.dark ? '1' : '0',
    loading: s.loading ? '1' : '0',
    long: s.long ? '1' : '0',
  }).toString()}`;
}

function DeviceFrame({ device, src, caption }: { device: Device; src: string; caption?: string }) {
  return (
    <figure className="flex flex-none flex-col gap-2">
      <figcaption className="flex items-baseline gap-2 px-1">
        <span className="text-sm font-semibold text-zinc-100">
          {caption ?? `${device.label}px`}
        </span>
        {device.note ? <span className="text-[11px] text-zinc-500">{device.note}</span> : null}
      </figcaption>
      <div
        className="overflow-hidden rounded-[26px] border border-zinc-700/70 bg-zinc-950 shadow-2xl ring-1 ring-black/40"
        style={{ width: device.w, maxWidth: '100%' }}
      >
        <iframe
          title={caption ?? `${device.label}px preview`}
          src={src}
          width={device.w}
          height={device.h}
          className="block border-0 bg-white"
          style={{ width: device.w, height: device.h }}
        />
      </div>
    </figure>
  );
}

function Pill({
  active,
  accent,
  onClick,
  children,
  sub,
}: {
  active: boolean;
  accent?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'flex flex-col items-start rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
        (active
          ? accent
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-zinc-100 text-zinc-900 shadow-sm'
          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white')
      }
    >
      <span>{children}</span>
      {sub ? (
        <span className={'text-[10px] font-normal ' + (active ? 'opacity-80' : 'text-zinc-500')}>
          {sub}
        </span>
      ) : null}
    </button>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={
        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ' +
        (active
          ? 'border-blue-400/40 bg-blue-500/15 text-blue-200'
          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200')
      }
    >
      <span
        className={'h-2 w-2 rounded-full ' + (active ? 'bg-blue-400' : 'bg-zinc-600')}
        aria-hidden="true"
      />
      {children}
    </button>
  );
}

export function HarnessShell() {
  const [state, setState] = React.useState<ShellState>({
    scenario: 'details',
    variant: 'c',
    dark: false,
    loading: false,
    long: false,
  });

  const set = <K extends keyof ShellState>(key: K, value: ShellState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const activeVariant = variantEntry(state.variant);

  return (
    <div className="min-h-[100dvh] bg-[#0b0b0f] text-zinc-200">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0b0b0f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <h1 className="text-base font-semibold text-white">WizardNavigation · dev harness</h1>
              <p className="text-xs text-zinc-500">
                Each frame is an isolated iframe, so <code className="text-zinc-400">sm:</code>{' '}
                breakpoints respond to the frame width — not this screen.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Toggle active={state.loading} onClick={() => set('loading', !state.loading)}>
                Submitting
              </Toggle>
              <Toggle active={state.long} onClick={() => set('long', !state.long)}>
                Long content
              </Toggle>
              <Toggle active={state.dark} onClick={() => set('dark', !state.dark)}>
                Dark
              </Toggle>
            </div>
          </div>

          {/* Direction selector (the main comparison axis) */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Direction
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
              {VARIANTS.map((v) => (
                <Pill
                  key={v.key}
                  active={state.variant === v.key}
                  accent
                  onClick={() => set('variant', v.key)}
                  sub={v.blurb}
                >
                  {v.label}
                </Pill>
              ))}
            </div>
          </div>

          {/* Scenario / wizard step */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Step
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
              {SCENARIOS.map((s) => (
                <Pill
                  key={s.key}
                  active={state.scenario === s.key}
                  onClick={() => set('scenario', s.key)}
                >
                  {s.label}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {activeVariant.label} <span className="text-zinc-600">· across widths</span>
          </h2>
          <div className="harness-scroll flex gap-6 overflow-x-auto pb-4">
            {PHONE_TABLET.map((device) => (
              <DeviceFrame key={device.label} device={device} src={frameSrc(state)} />
            ))}
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {activeVariant.label} <span className="text-zinc-600">· desktop</span>
          </h2>
          <div className="harness-scroll overflow-x-auto pb-4">
            <DeviceFrame device={DESKTOP} src={frameSrc(state)} />
          </div>
        </section>

        <section className="mt-10 flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            All directions <span className="text-zinc-600">· @ 390px, same state</span>
          </h2>
          <div className="harness-scroll flex gap-6 overflow-x-auto pb-4">
            {VARIANTS.map((v) => (
              <DeviceFrame
                key={v.key}
                device={COMPARE}
                src={frameSrc(state, { variant: v.key })}
                caption={v.label}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
