'use client';

import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  SEARCH_FIELD_LABELS,
  SEARCH_FIELD_PLACEHOLDERS,
  type SearchField,
} from '../opsEmailDeliveryFilterDomain';

export type OpsEmailDeliverySearchControlsProps = {
  onSearchFieldChange: (field: SearchField) => void;
  onSearchValueChange: (value: string) => void;
  onSubmitSearch: () => void;
  searchField: SearchField;
  searchValue: string;
};

export function OpsEmailDeliverySearchControls({
  onSearchFieldChange,
  onSearchValueChange,
  onSubmitSearch,
  searchField,
  searchValue,
}: OpsEmailDeliverySearchControlsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={searchField}
        onValueChange={(value) => onSearchFieldChange(value as SearchField)}
      >
        <SelectTrigger className="w-full sm:w-[150px]" aria-label="Search field">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(SEARCH_FIELD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="flex flex-1 gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            name="emailDeliverySearch"
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
            placeholder={SEARCH_FIELD_PLACEHOLDERS[searchField]}
            className="pl-9"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmitSearch();
              }
            }}
            aria-label="Search email delivery attempts"
          />
        </div>
        <Button type="button" onClick={onSubmitSearch} aria-label="Search">
          Search
        </Button>
      </div>
    </div>
  );
}
