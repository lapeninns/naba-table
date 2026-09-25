import { ChevronDown } from 'lucide-react';

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

import { TABLE_FORM_LIMITS, type TableFormErrors } from './tableInventoryFormDomain';
import {
  CATEGORY_OPTIONS,
  MOBILITY_OPTIONS,
  SEATING_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from './tableInventoryModel';
import { describedBy, TABLE_TOUCH_TARGET_CLASS, TableFieldError } from './TableInventoryParts';

import type { TableInventory } from '@/services/ops/tables';

export function TableInventoryClassificationFields({
  open,
  onOpenChange,
  category,
  mobility,
  seatingType,
  setCategory,
  setMobility,
  setSeatingType,
  setStatus,
  status,
  table,
  errors,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly category: TableInventory['category'];
  readonly mobility: TableInventory['mobility'];
  readonly seatingType: TableInventory['seatingType'];
  readonly setCategory: (category: TableInventory['category']) => void;
  readonly setMobility: (mobility: TableInventory['mobility']) => void;
  readonly setSeatingType: (seatingType: TableInventory['seatingType']) => void;
  readonly setStatus: (status: TableInventory['status']) => void;
  readonly status: TableInventory['status'];
  readonly table: TableInventory | null;
  readonly errors: TableFormErrors;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-lg border border-border/60"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={`group h-auto w-full justify-between gap-3 whitespace-normal px-3 py-2.5 text-left ${TABLE_TOUCH_TARGET_CLASS}`}
        >
          <span className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
            Details and service notes
            <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </Button>
      </CollapsibleTrigger>
      {/* Content stays mounted so section and notes are always submitted with the form. */}
      <CollapsibleContent forceMount className="px-3 pb-3 data-[state=closed]:hidden">
        <div className="grid gap-4 pt-1">
          <div className="grid gap-2">
            <Label htmlFor="status">Service status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as TableInventory['status'])}
            >
              <SelectTrigger
                id="status"
                className={TABLE_TOUCH_TARGET_CLASS}
                aria-describedby="status-hint"
              >
                <SelectValue placeholder="Choose a status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="status-hint" className="text-xs leading-5 text-muted-foreground">
              Only “Out of service” stops bookings being assigned. The others are for your notes.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid content-start gap-2">
              <Label htmlFor="seatingType">Seating</Label>
              <Select
                value={seatingType}
                onValueChange={(value) => setSeatingType(value as TableInventory['seatingType'])}
              >
                <SelectTrigger id="seatingType" className={TABLE_TOUCH_TARGET_CLASS}>
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
            <div className="grid content-start gap-2">
              <Label htmlFor="mobility">Can it be moved?</Label>
              <Select
                value={mobility}
                onValueChange={(value) => setMobility(value as TableInventory['mobility'])}
              >
                <SelectTrigger id="mobility" className={TABLE_TOUCH_TARGET_CLASS}>
                  <SelectValue placeholder="Choose" />
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
            <div className="grid content-start gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as TableInventory['category'])}
              >
                <SelectTrigger id="category" className={TABLE_TOUCH_TARGET_CLASS}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Seating, category and section are for your records and don’t change which bookings a
            table gets.
          </p>

          <div className="grid gap-2">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              name="section"
              defaultValue={table?.section ?? ''}
              placeholder="e.g. By the window"
              maxLength={TABLE_FORM_LIMITS.sectionMax}
              aria-invalid={errors.section ? true : undefined}
              aria-describedby={describedBy(errors.section && 'section-error')}
            />
            <TableFieldError id="section-error" message={errors.section} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={table?.notes ?? ''}
              rows={3}
              maxLength={TABLE_FORM_LIMITS.notesMax}
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={describedBy('notes-hint', errors.notes && 'notes-error')}
            />
            <p id="notes-hint" className="text-xs leading-5 text-muted-foreground">
              Up to 500 characters.
            </p>
            <TableFieldError id="notes-error" message={errors.notes} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
