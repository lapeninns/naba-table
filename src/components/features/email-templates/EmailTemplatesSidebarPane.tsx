'use client';

import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-zinc-200 bg-zinc-50/70 md:w-80 xl:w-[22rem]">
      <div className="border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">
            Email Templates
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-950">Command Center</h1>
          <p className="text-sm text-zinc-600">Editing copy for {restaurantName}.</p>
        </div>

        <div className="mt-4">
          <Label htmlFor="email-template-search" className="sr-only">
            Search templates
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              id="email-template-search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search templates..."
              className="h-11 rounded-xl border-zinc-200 bg-white pl-9 text-sm shadow-sm focus-visible:ring-indigo-500/25"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {filteredGroups.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="space-y-1">
              <h2 className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-600">
                {group.title}
              </h2>
              <p className="px-1 text-xs leading-5 text-zinc-600">{group.description}</p>
            </div>

            <div className="space-y-2">
              {group.templates.map((template) => {
                const active = selectedTemplateKey === template.key;
                const dirty = dirtyTemplateKeys.has(template.key);

                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => onSelectTemplate(template.key)}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition-all duration-200',
                      active
                        ? 'border-indigo-200 bg-indigo-50/80 text-indigo-700 ring-1 ring-indigo-100'
                        : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-100/80',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className={cn('truncate text-sm font-semibold', active ? 'text-indigo-700' : 'text-zinc-900')}>
                          {template.title}
                        </div>
                        <p className="line-clamp-2 text-xs leading-5 text-zinc-600">
                          {template.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {dirty ? <span className="size-2 rounded-full bg-amber-400" aria-label="Unsaved changes" /> : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-zinc-200 bg-white/70 text-[11px] font-medium',
                            active && 'border-indigo-200 bg-indigo-100/80 text-indigo-700',
                          )}
                        >
                          {template.variants.filter((variant) => variant.isActive).length} live
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {filteredGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm text-zinc-500">
            No templates match “{searchQuery}”.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
