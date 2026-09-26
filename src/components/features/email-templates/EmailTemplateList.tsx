'use client';

import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type {
  EmailTemplateListItem,
  OpsEmailTemplatesEditor,
} from '@/hooks/ops/useOpsEmailTemplatesEditor';
import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';

function TemplateStatus({ item }: { item: EmailTemplateListItem }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      {item.isDirty ? (
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <span className="size-1.5 rounded-full bg-foreground" aria-hidden />
          Unsaved
        </span>
      ) : null}
      {item.isCustom && item.liveCount === 0 ? (
        <Badge className="rounded-full px-2 py-0 text-xs font-medium">No live</Badge>
      ) : (
        <span>{item.isCustom ? `Custom · ${item.liveCount} live` : 'Default'}</span>
      )}
    </span>
  );
}

export function EmailTemplateList({
  editor,
  onSelect,
}: {
  editor: OpsEmailTemplatesEditor;
  onSelect: (key: RestaurantBookingEmailTemplateKey) => void;
}) {
  const { groups, search, templateKey, templateCount, customisedCount } = editor;

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div className="grid gap-2 px-3 pb-2 pt-3">
        <p className="text-xs text-muted-foreground">
          {templateCount} guest emails ·{' '}
          {customisedCount ? `${customisedCount} customised` : 'all using Nabatable defaults'}.
          Saved changes apply to emails sent afterwards.
        </p>
        <Label htmlFor="email-template-search" className="sr-only">
          Search templates
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="email-template-search"
            type="search"
            value={search}
            onChange={(event) => editor.setSearch(event.target.value)}
            placeholder="Search templates"
            autoComplete="off"
            className="pl-8"
          />
        </div>
      </div>
      <nav aria-label="Templates" className="min-h-0 overflow-y-auto px-2 pb-6">
        {groups.length ? (
          groups.map((group) => (
            <div key={group.key} className="mt-2.5">
              <h2 className="px-2 pb-1 text-xs font-semibold text-muted-foreground">
                {group.title}
              </h2>
              <ul>
                {group.templates.map((item) => {
                  const current = item.key === templateKey;
                  return (
                    <li key={item.key}>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-current={current ? 'true' : undefined}
                        onClick={() => onSelect(item.key)}
                        className={cn(
                          'grid h-auto min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 whitespace-normal border border-transparent px-2 py-2 text-left font-normal',
                          current && 'border-border bg-muted',
                        )}
                      >
                        <span className={cn('truncate', current ? 'font-semibold' : 'font-medium')}>
                          {item.title}
                        </span>
                        <TemplateStatus item={item} />
                        <span className="col-span-2 text-xs leading-snug text-muted-foreground">
                          {item.description}
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No templates match “{search}”.
          </p>
        )}
      </nav>
    </div>
  );
}
