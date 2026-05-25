import { Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { TEMPLATE_FIELD_LABELS, type TemplateCopyField } from './emailTemplatesEditorDomain';

import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

export function EmailTemplatesGuidanceSection({
  baseTemplate,
  canEdit,
  onInsertVariable,
  tokenTarget,
}: {
  readonly baseTemplate: RestaurantEmailTemplate;
  readonly canEdit: boolean;
  readonly onInsertVariable: (token: string) => void;
  readonly tokenTarget: TemplateCopyField;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr),20rem]">
      <Alert className="border-primary/20 bg-primary/10 text-foreground">
        <Sparkles className="size-4 text-primary" />
        <AlertTitle>Template guidance</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm text-foreground">
            Recommended variables for {baseTemplate.title.toLowerCase()}:
          </p>
          <div className="flex flex-wrap gap-2">
            {baseTemplate.recommendedVariables.map((token) => (
              <Badge
                key={token}
                variant="secondary"
                className="rounded-full bg-primary/10 text-primary"
              >
                {token}
              </Badge>
            ))}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {baseTemplate.authoringHints.map((hint) => (
              <p key={hint}>{hint}</p>
            ))}
          </div>
        </AlertDescription>
      </Alert>

      <div className="rounded-[1.5rem] border border-border bg-background px-4 py-4 shadow-sm">
        <div className="text-sm font-semibold text-foreground">Token insertion</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Click inside a field to change the insertion target, then tap a variable chip.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {baseTemplate.availableVariables.map((token) => {
            const recommended = baseTemplate.recommendedVariables.includes(token);
            return (
              <Button
                key={token}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onInsertVariable(token)}
                disabled={!canEdit}
                className={cn(
                  'rounded-full font-mono text-[11px]',
                  recommended && 'border-primary/30 bg-primary/10 text-primary',
                )}
              >
                {token}
              </Button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Current insertion target:{' '}
          <span className="font-medium text-foreground">{TEMPLATE_FIELD_LABELS[tokenTarget]}</span>
        </p>
      </div>
    </section>
  );
}

export function DuplicateVariantAlert({
  duplicateActiveVariantName,
}: {
  readonly duplicateActiveVariantName: string | null;
}) {
  if (!duplicateActiveVariantName) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>Duplicate live variant copy</AlertTitle>
      <AlertDescription>
        This active variant matches {duplicateActiveVariantName}. Change the delivery copy or pause
        one version so your A/B rotation stays meaningful.
      </AlertDescription>
    </Alert>
  );
}
