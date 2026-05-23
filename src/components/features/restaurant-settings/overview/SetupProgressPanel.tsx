import { motion } from 'motion/react';

import type { RequiredSetupSummary } from './buildSetupCards';

type SetupProgressPanelProps = {
  requiredSetup: RequiredSetupSummary;
};

export function SetupProgressPanel({ requiredSetup }: SetupProgressPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6"
    >
      <div
        className="absolute -right-20 -top-20 size-60 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Onboarding Progress
          </span>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {requiredSetup.title}
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">{requiredSetup.description}</p>
        </div>
        <div className="shrink-0 flex items-baseline gap-1 text-right">
          <span className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {requiredSetup.percent}%
          </span>
          <span className="text-xs font-medium text-muted-foreground">complete</span>
        </div>
      </div>

      <div className="mt-5 relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${requiredSetup.percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 via-primary to-indigo-500"
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {requiredSetup.complete} of {requiredSetup.total} required steps complete
        </span>
        <span>{requiredSetup.footer}</span>
      </div>
    </motion.div>
  );
}
