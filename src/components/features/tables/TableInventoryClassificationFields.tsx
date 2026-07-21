import { ChevronDown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

import {
  CATEGORY_OPTIONS,
  MOBILITY_OPTIONS,
  SEATING_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from './tableInventoryModel';

import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryClassificationFields({
  category,
  isFirstTable,
  mobility,
  seatingType,
  setCategory,
  setMobility,
  setSeatingType,
  setStatus,
  status,
  table,
}: {
  readonly category: TableInventory['category'];
  readonly isFirstTable: boolean;
  readonly mobility: TableInventory['mobility'];
  readonly seatingType: TableInventory['seatingType'];
  readonly setCategory: (category: TableInventory['category']) => void;
  readonly setMobility: (mobility: TableInventory['mobility']) => void;
  readonly setSeatingType: (seatingType: TableInventory['seatingType']) => void;
  readonly setStatus: (status: TableInventory['status']) => void;
  readonly status: TableInventory['status'];
  readonly table: TableInventory | null;
}) {
  return (
    <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              Classification &amp; service notes
              {isFirstTable ? <Badge variant="outline">Optional</Badge> : null}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Add section, classification, seating type, mobility, status, and notes when needed.
            </span>
          </span>
          <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              name="section"
              defaultValue={table?.section ?? ''}
              placeholder="Main Dining, Patio, Bar"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as TableInventory['category'])}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Text variant="caption">
                For organizational purposes only. Does not affect allocation.
              </Text>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="seatingType">Seating</Label>
              <Select
                value={seatingType}
                onValueChange={(value) => setSeatingType(value as TableInventory['seatingType'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose seating" />
                </SelectTrigger>
                <SelectContent>
                  {SEATING_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mobility">Mobility</Label>
              <Select
                value={mobility}
                onValueChange={(value) => setMobility(value as TableInventory['mobility'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose mobility" />
                </SelectTrigger>
                <SelectContent>
                  {MOBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as TableInventory['status'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Text variant="caption">
                &apos;Out of service&apos; blocks assignments. Other statuses are informational.
              </Text>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={table?.notes ?? ''}
              placeholder="Optional internal notes about this table"
              rows={3}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
