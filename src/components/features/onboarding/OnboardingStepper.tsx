import { cn } from '@/lib/utils';

type Step = {
  id: number;
  label: string;
  href?: string;
};

type Props = {
  current: number;
  steps: ReadonlyArray<Step>;
};

export function OnboardingStepper({ current, steps }: Props) {
  const total = steps.length;
  const progress = total <= 1 ? 100 : ((current - 1) / (total - 1)) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span>{`Step ${current} of ${total}`}</span>
        <span aria-hidden>{`${Math.round(progress)}% complete`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>
      <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Onboarding steps">
        {steps.map((step) => {
          const isCurrent = step.id === current;
          const isComplete = step.id < current;
          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm',
                isCurrent && 'border-primary/60 bg-primary/5 text-primary',
                isComplete && 'border-primary/40 bg-primary/5 text-foreground',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold',
                  isCurrent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isComplete
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/60 text-muted-foreground',
                )}
              >
                {step.id}
              </span>
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
