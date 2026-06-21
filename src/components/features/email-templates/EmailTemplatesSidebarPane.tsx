'use client';

import { Search } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';
import type { RestaurantEmailTemplateGroup } from '@/services/ops/restaurants';

type EmailTemplatesSidebarPaneProps = {
  filteredGroups: RestaurantEmailTemplateGroup[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedTemplateKey: RestaurantBookingEmailTemplateKey | null;
  dirtyTemplateKeys: Set<RestaurantBookingEmailTemplateKey>;
  restaurantName: string;
  onSelectTemplate: (templateKey: RestaurantBookingEmailTemplateKey) => void;
};

export function EmailTemplatesSidebarPane({
  filteredGroups,
  searchQuery,
  onSearchQueryChange,
  selectedTemplateKey,
  dirtyTemplateKeys,
  restaurantName,
  onSelectTemplate,
}: EmailTemplatesSidebarPaneProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-muted/40 md:w-80 xl:w-[22rem]">
      <div className="border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Email Templates
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground">Editing copy for {restaurantName}.</p>
        </div>

        <div className="mt-4">
          <Label htmlFor="email-template-search" className="sr-only">
            Search templates
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email-template-search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search templates..."
              className="h-11 rounded-xl border-border bg-background pl-9 text-sm shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {filteredGroups.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="space-y-1">
              <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                {group.title}
              </h2>
              <p className="px-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
            </div>

            <div className="space-y-2">
              {group.templates.map((template) => {
                const active = selectedTemplateKey === template.key;
                const dirty = dirtyTemplateKeys.has(template.key);

                return (
                  <Button
                    key={template.key}
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectTemplate(template.key)}
                    className={cn(
                      'h-auto w-full justify-start whitespace-normal rounded-2xl border px-4 py-3 text-left shadow-sm',
                      active
                        ? 'border-primary/30 bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'border-border bg-background text-foreground hover:border-primary/30 hover:bg-muted/80',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div
                          className={cn(
                            'truncate text-sm font-semibold',
                            active ? 'text-primary' : 'text-foreground',
                          )}
                        >
                          {template.title}
                        </div>
                        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {template.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {dirty ? (
                          <span
                            className="size-2 rounded-full bg-primary"
                            aria-label="Unsaved changes"
                          />
                        ) : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-border bg-background/70 text-[11px] font-medium',
                            active && 'border-primary/30 bg-primary/10 text-primary',
                          )}
                        >
                          {template.variants.filter((variant) => variant.isActive).length} live
                        </Badge>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </section>
        ))}

        {filteredGroups.length === 0 ? (
          <OpsEmptyState
            title="No templates match"
            description={`No templates match "${searchQuery}".`}
            className="min-h-[180px] bg-background px-5 py-10"
          />
        ) : null}
      </div>
    </aside>
  );
}
