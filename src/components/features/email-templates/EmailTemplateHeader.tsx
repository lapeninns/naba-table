'use client';

import { ChevronLeft, Eye, MoreHorizontal, RotateCcw, Send } from 'lucide-react';

import { SettingsSegmentedControl } from '@/components/features/restaurant-settings/shared/SettingsSegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { OpsEmailTemplatesEditor } from '@/hooks/ops/useOpsEmailTemplatesEditor';
import type { ReactNode } from 'react';

export type EmailTemplatesTab = 'edit' | 'preview';

const TAB_OPTIONS = [
  { value: 'edit', label: 'Edit' },
  { value: 'preview', label: 'Preview', icon: <Eye aria-hidden /> },
] as const satisfies readonly { value: EmailTemplatesTab; label: string; icon?: ReactNode }[];

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
          <Badge variant={isCustom ? 'status-completed' : 'outline'}>
            {isCustom ? 'Customised' : 'Default copy'}
          </Badge>
          <span className="break-all font-mono text-xs font-normal text-muted-foreground">
            {template.key}
          </span>
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Sent for: {template.description}</p>
      </div>
      {/* When the actions wrap under the title they stay end-aligned (RR5). */}
      <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
        <SettingsSegmentedControl
          value={tab}
          onValueChange={onTabChange}
          options={TAB_OPTIONS}
          ariaLabel="Show"
          className="@6xl:hidden"
        />
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
          <DropdownMenuContent
            align="end"
            collisionPadding={16}
            className="w-72 max-w-[calc(100vw-2rem)]"
          >
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
