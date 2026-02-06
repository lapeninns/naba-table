'use client';

import { Filter, Search } from 'lucide-react';
import { useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';
import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type OpsEmailDeliveryFiltersCardProps = {
  range: OpsEmailDeliveryRange;
  statuses: EmailDeliveryStatus[];
  searchValue: string;
  templateType: string | null;
  emailType: string | null;
  onSearchValueChange: (next: string) => void;
  onSubmitSearch: () => void;
  onRangeChange: (next: OpsEmailDeliveryRange) => void;
  onToggleStatus: (status: EmailDeliveryStatus, enabled: boolean) => void;
  onTemplateTypeChange: (next: string | null) => void;
  onTemplateTypeCommit: (next: string | null) => void;
  onEmailTypeChange: (next: string | null) => void;
  onEmailTypeCommit: (next: string | null) => void;
  onClear: () => void;
};

export function OpsEmailDeliveryFiltersCard({
  range,
  statuses,
  searchValue,
  templateType,
  emailType,
  onSearchValueChange,
  onSubmitSearch,
  onRangeChange,
  onToggleStatus,
  onTemplateTypeChange,
  onTemplateTypeCommit,
  onEmailTypeChange,
  onEmailTypeCommit,
  onClear,
}: OpsEmailDeliveryFiltersCardProps) {
  const handleRangeChange = useCallback(
    (value: string) => {
      if (value !== '24h' && value !== '7d' && value !== '30d') return;
      const next = value as OpsEmailDeliveryRange;
      if (next === range) return;
      onRangeChange(next);
    },
    [onRangeChange, range],
  );

  return (
    <Card className="border-slate-200/60 bg-white">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <Input
                name="email_delivery_search"
                value={searchValue}
                onChange={(e) => onSearchValueChange(e.target.value)}
                placeholder="Search (email, message id, booking ref)…"
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSubmitSearch();
                  }
                }}
                aria-label="Search email delivery events"
              />
            </div>
          </div>
          <Button type="button" onClick={onSubmitSearch} className="md:w-auto w-full">
            Search
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={handleRangeChange}
            className="justify-start"
            aria-label="Select time range"
          >
            <ToggleGroupItem value="24h" aria-label="Last 24 hours">
              24h
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" aria-label="Last 7 days">
              7d
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" aria-label="Last 30 days">
              30d
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" aria-hidden />
                  Status
                  {statuses.length > 0 ? (
                    <Badge variant="secondary" className="ml-1">
                      {statuses.length}
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Statuses</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {EMAIL_DELIVERY_STATUS_VALUES.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={statuses.includes(status)}
                    onCheckedChange={(checked) => onToggleStatus(status, Boolean(checked))}
                  >
                    {EMAIL_DELIVERY_STATUS_LABELS[status]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" className="gap-2" onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            name="email_delivery_template_type"
            value={templateType ?? ''}
            onChange={(e) => onTemplateTypeChange(e.target.value.trim() || null)}
            placeholder="Template type (optional)"
            aria-label="Filter by template type"
            onBlur={(e) => onTemplateTypeCommit(e.currentTarget.value.trim() || null)}
          />
          <Input
            name="email_delivery_email_type"
            value={emailType ?? ''}
            onChange={(e) => onEmailTypeChange(e.target.value.trim() || null)}
            placeholder="Email type (optional)"
            aria-label="Filter by email type"
            onBlur={(e) => onEmailTypeCommit(e.currentTarget.value.trim() || null)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
