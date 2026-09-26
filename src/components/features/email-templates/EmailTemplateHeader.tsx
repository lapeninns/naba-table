'use client';

import { ChevronLeft, Eye, MoreHorizontal, RotateCcw, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import type { OpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';

export type EmailTemplatesTab = 'edit' | 'preview';

const segmentClass =
  'h-8 min-h-0 min-w-0 gap-1.5 px-2.5 text-sm data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm';

export function EmailTemplateHeader({
  editor,
  tab,
  onTabChange,
  onBack,
  onSendTest,
  onReset,
}: {
  editor: OpsEmailTemplatesEditor;
  tab: EmailTemplatesTab;
  onTabChange: (tab: EmailTemplatesTab) => void;
  onBack: () => void;
  onSendTest: () => void;
  onReset: () => void;
}) {
  const { template, canEdit } = editor;
  if (!template) return null;
  const isCustom = template.status === 'custom';

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="@2xl:hidden"
        aria-label="Back to templates"
        onClick={onBack}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <div className="min-w-0 flex-[1_1_280px]">
        <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold">
          {template.title}
          <Badge
            variant={isCustom ? 'secondary' : 'outline'}
            className={cn(
              'rounded-full px-2 py-0 text-xs font-medium',
              !isCustom && 'text-muted-foreground',
            )}
          >
            {isCustom ? 'Customised' : 'Default copy'}
          </Badge>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {template.key}
          </span>
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Sent for: {template.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={tab}
          onValueChange={(value) => value && onTabChange(value as EmailTemplatesTab)}
          aria-label="Show"
          className="rounded-lg bg-muted p-0.5 @6xl:hidden"
        >
          <ToggleGroupItem value="edit" className={segmentClass}>
            Edit
          </ToggleGroupItem>
          <ToggleGroupItem value="preview" className={segmentClass}>
            <Eye aria-hidden />
            Preview
          </ToggleGroupItem>
        </ToggleGroup>
        <Button type="button" variant="outline" disabled={!canEdit} onClick={onSendTest}>
          <Send aria-hidden />
          Send test
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="More template actions">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem
              disabled={!canEdit || !isCustom}
              onSelect={onReset}
              className="items-start"
            >
              <RotateCcw aria-hidden className="mt-0.5" />
              <span>
                Reset to Nabatable defaults
                <span className="block text-xs text-muted-foreground">
                  {isCustom
                    ? 'Removes your custom variants for this email.'
                    : 'Already using the defaults.'}
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
