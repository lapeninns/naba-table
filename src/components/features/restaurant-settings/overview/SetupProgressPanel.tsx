import { motion } from 'motion/react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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
      className="overflow-hidden"
    >
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <Badge variant="metric" className="w-fit">
                Onboarding progress
              </Badge>
              <CardTitle className="text-xl leading-tight sm:text-2xl">
                {requiredSetup.title}
              </CardTitle>
              <CardDescription className="max-w-xl text-xs leading-5">
                {requiredSetup.description}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-baseline gap-1 text-right">
              <span className="text-3xl font-bold text-foreground sm:text-4xl">
                {requiredSetup.percent}%
              </span>
              <span className="text-xs font-medium text-muted-foreground">complete</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
          <Progress value={requiredSetup.percent} aria-label="Required setup completion" />

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {requiredSetup.complete} of {requiredSetup.total} required steps complete
            </span>
            <span>{requiredSetup.footer}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
