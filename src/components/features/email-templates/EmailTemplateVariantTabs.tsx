import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';

type EmailTemplateVariantTabsProps = {
  readonly canEdit: boolean;
  readonly currentVariant: RestaurantEmailTemplateVariant;
  readonly currentVariants: ReadonlyArray<RestaurantEmailTemplateVariant>;
  readonly onAddVariant: () => void;
  readonly onMoveVariant: (variantId: string, direction: -1 | 1) => void;
  readonly onSelectVariant: (variantId: string) => void;
  readonly selectedVariantId: string | null;
};

export function EmailTemplateVariantTabs({
  canEdit,
  currentVariant,
  currentVariants,
  onAddVariant,
  onMoveVariant,
  onSelectVariant,
  selectedVariantId,
}: EmailTemplateVariantTabsProps) {
  const currentIndex = currentVariants.findIndex((variant) => variant.id === currentVariant.id);

  return (
    <div className="border-b border-border px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Variants</div>
          <p className="text-xs text-muted-foreground">
            Tabs keep each test branch isolated while you edit one version at a time.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onAddVariant}
          disabled={!canEdit || currentVariants.length >= 5}
        >
          <Plus data-icon="inline-start" />
          Add variant
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        {currentVariants
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((variant) => {
            const active = selectedVariantId === variant.id;

            return (
              <Button
                key={variant.id}
                type="button"
                variant="ghost"
                onClick={() => onSelectVariant(variant.id)}
                className={cn(
                  'relative h-auto whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <span>{variant.name}</span>
                {!variant.isActive ? (
                  <Badge
                    variant="outline"
                    className="ml-2 border-border bg-background text-[11px] text-muted-foreground"
                  >
                    Paused
                  </Badge>
                ) : null}
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                ) : null}
              </Button>
            );
          })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onMoveVariant(currentVariant.id, -1)}
          disabled={!canEdit || currentIndex === 0}
        >
          <ChevronLeft data-icon="inline-start" />
          Earlier
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onMoveVariant(currentVariant.id, 1)}
          disabled={!canEdit || currentIndex === currentVariants.length - 1}
        >
          Later
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
