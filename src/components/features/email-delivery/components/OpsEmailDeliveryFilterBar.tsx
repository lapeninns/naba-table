'use client';

import { X } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { OpsEmailDeliveryFilterControls } from './OpsEmailDeliveryFilterControls';
import { OpsEmailDeliverySearchControls } from './OpsEmailDeliverySearchControls';
import { OpsEmailDeliveryStatusFilterPopover } from './OpsEmailDeliveryStatusFilterPopover';
import {
  resolveOpsEmailDeliveryRangeChange,
  type SearchField,
} from '../opsEmailDeliveryFilterDomain';

import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type { SearchField } from '../opsEmailDeliveryFilterDomain';
export { EMAIL_TYPE_OPTIONS, TEMPLATE_TYPE_OPTIONS } from '../opsEmailDeliveryFilterDomain';

export type OpsEmailDeliveryFilterBarProps = {
  searchField: SearchField;
  searchValue: string;
  onSearchFieldChange: (field: SearchField) => void;
  onSearchValueChange: (value: string) => void;
  onSubmitSearch: () => void;
  range: OpsEmailDeliveryRange;
  onRangeChange: (range: OpsEmailDeliveryRange) => void;
  templateType: string | null;
  onTemplateTypeChange: (value: string | null) => void;
  emailType: string | null;
  onEmailTypeChange: (value: string | null) => void;
  statuses: EmailDeliveryStatus[];
  statusCounts?: Partial<Record<EmailDeliveryStatus, number>> | null;
  onToggleStatus: (status: EmailDeliveryStatus, enabled: boolean) => void;
  onClear: () => void;
};

export function OpsEmailDeliveryFilterBar({
  searchField,
  searchValue,
  onSearchFieldChange,
  onSearchValueChange,
  onSubmitSearch,
  range,
  onRangeChange,
  templateType,
  onTemplateTypeChange,
  emailType,
  onEmailTypeChange,
  statuses,
  statusCounts,
  onToggleStatus,
  onClear,
}: OpsEmailDeliveryFilterBarProps) {
  const handleRangeChange = useCallback(
    (value: string) => {
      const next = resolveOpsEmailDeliveryRangeChange(value, range);
      if (next) {
        onRangeChange(next);
      }
    },
    [onRangeChange, range],
  );

  return (
    <div className="flex flex-col gap-3">
      <OpsEmailDeliverySearchControls
        searchField={searchField}
        searchValue={searchValue}
        onSearchFieldChange={onSearchFieldChange}
        onSearchValueChange={onSearchValueChange}
        onSubmitSearch={onSubmitSearch}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <OpsEmailDeliveryFilterControls
          emailType={emailType}
          onEmailTypeChange={onEmailTypeChange}
          onRangeValueChange={handleRangeChange}
          onTemplateTypeChange={onTemplateTypeChange}
          range={range}
          templateType={templateType}
        />

        <Separator orientation="vertical" className="hidden h-6 sm:block" decorative />

        <OpsEmailDeliveryStatusFilterPopover
          statusCounts={statusCounts}
          statuses={statuses}
          onToggleStatus={onToggleStatus}
        />

        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear all filters">
          <X data-icon="inline-start" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  );
}
