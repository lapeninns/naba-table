'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import {
  EMAIL_DELIVERY_RANGE_OPTIONS,
  EMAIL_TYPE_OPTIONS,
  TEMPLATE_TYPE_OPTIONS,
  formatEmailDeliveryFilterOptionLabel,
} from '../opsEmailDeliveryFilterDomain';

import type { OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type OpsEmailDeliveryFilterControlsProps = {
  emailType: string | null;
  onEmailTypeChange: (value: string | null) => void;
  onRangeValueChange: (value: string) => void;
  onTemplateTypeChange: (value: string | null) => void;
  range: OpsEmailDeliveryRange;
  templateType: string | null;
};

export function OpsEmailDeliveryFilterControls({
  emailType,
  onEmailTypeChange,
  onRangeValueChange,
  onTemplateTypeChange,
  range,
  templateType,
}: OpsEmailDeliveryFilterControlsProps) {
  return (
    <>
      <ToggleGroup
        type="single"
        value={range}
        onValueChange={onRangeValueChange}
        className="justify-start"
        aria-label="Select time range"
      >
        {EMAIL_DELIVERY_RANGE_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.ariaLabel}
            className="px-3 text-xs"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Separator orientation="vertical" className="hidden h-6 sm:block" decorative />

      <Select
        value={templateType ?? '__all__'}
        onValueChange={(value) => onTemplateTypeChange(value === '__all__' ? null : value)}
      >
        <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by template type">
          <SelectValue placeholder="Template type" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="__all__">All templates</SelectItem>
            {TEMPLATE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {formatEmailDeliveryFilterOptionLabel(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={emailType ?? '__all__'}
        onValueChange={(value) => onEmailTypeChange(value === '__all__' ? null : value)}
      >
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by email type">
          <SelectValue placeholder="Email type" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="__all__">All types</SelectItem>
            {EMAIL_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {formatEmailDeliveryFilterOptionLabel(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}
