'use client';

import { Check, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { getTableBookingStatus, type TableZoneLookup } from './tableInventoryDisplayDomain';
import { TABLE_FORM_LIMITS, type TableDraft } from './tableInventoryFormDomain';
import { CATEGORY_OPTIONS, SEATING_TYPE_OPTIONS, STATUS_OPTIONS } from './tableInventoryModel';
import {
  getJoinPartners,
  getTableLargestParty,
  isMovableTable,
  TABLE_JOIN_MAX_TABLES,
} from './tableRoomDomain';
import {
  describedBy,
  JoinIcon,
  LockIcon,
  TABLE_TOUCH_TARGET_CLASS,
  TableFieldError,
  SWITCH_SIZE_CLASS,
} from './TableRoomParts';
import { TABLE_EDITOR_FIELD_PREFIX, type TableEditor } from './useTableEditorState';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

export const TABLE_EDITOR_FORM_ID = 'table-editor-form';

const fieldId = (name: string) => `${TABLE_EDITOR_FIELD_PREFIX}${name}`;

function Reason({
  icon,
  children,
  testId,
}: {
  icon: ReactNode;
  children: ReactNode;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-start gap-2 rounded-md bg-muted px-3 py-2.5 text-[13px] leading-5"
    >
      <span className="mt-1 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function sortNumbers(tables: ReadonlyArray<TableInventory>) {
  return [...tables].sort((a, b) =>
    a.tableNumber.localeCompare(b.tableNumber, 'en-GB', { numeric: true }),
  );
}

/** Why a saved table can or can't be joined, naming its partners and one example join. */
function JoinReason({
  table,
  tables,
  lookup,
  zoneName,
}: {
  table: TableInventory;
  tables: ReadonlyArray<TableInventory>;
  lookup: TableZoneLookup;
  zoneName: string;
}) {
  if (!isMovableTable(table)) {
    return (
      <Reason testId="join-reason" icon={<LockIcon />}>
        <b>Fixed.</b> Always used on its own, so it’s never joined with other tables.
      </Reason>
    );
  }
  if (!getTableBookingStatus(table, lookup).bookable) {
    return (
      <Reason testId="join-reason" icon={<JoinIcon />}>
        <b>Movable.</b> It can be joined again once it’s bookable.
      </Reason>
    );
  }
  const partners = getJoinPartners(table, tables, lookup);
  if (partners.length === 0) {
    return (
      <Reason testId="join-reason" icon={<JoinIcon />}>
        <b>Movable,</b> but there’s no other movable, bookable table in {zoneName} to join with.
      </Reason>
    );
  }
  const best = [
    table,
    ...[...partners].sort((a, b) => b.capacity - a.capacity).slice(0, TABLE_JOIN_MAX_TABLES - 1),
  ];
  return (
    <Reason testId="join-reason" icon={<JoinIcon />}>
      <b>Can be joined</b> with tables{' '}
      {sortNumbers(partners)
        .map((partner) => partner.tableNumber)
        .join(', ')}{' '}
      in {zoneName}, up to {TABLE_JOIN_MAX_TABLES} together. For example{' '}
      {sortNumbers(best)
        .map((item) => item.tableNumber)
        .join(' + ')}{' '}
      seats {best.reduce((sum, item) => sum + item.capacity, 0)}. Outlined in the room.
    </Reason>
  );
}

function OptionSelect<TValue extends string>({
  id,
  value,
  options,
  onChange,
  describedById,
}: {
  id: string;
  value: TValue;
  options: ReadonlyArray<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
  describedById?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TValue)}>
      <SelectTrigger
        id={id}
        className={cn('w-full', TABLE_TOUCH_TARGET_CLASS)}
        aria-describedby={describedById}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MobilityOption({
  value,
  checked,
  title,
  children,
}: {
  value: TableDraft['mobility'];
  checked: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <ToggleGroupItem
      value={value}
      className={cn(
        'h-auto min-h-9 min-w-0 w-full justify-start gap-2.5 whitespace-normal rounded-md border px-2.5 py-2 text-left font-normal text-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-transparent data-[state=on]:text-foreground',
        checked ? 'border-foreground' : 'border-border',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-[3px] grid size-4 shrink-0 place-items-center self-start rounded-full border',
          checked ? 'border-foreground' : 'border-muted-foreground',
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-foreground" /> : null}
      </span>
      <span>
        <b className="font-semibold">{title}</b>
        <br />
        <span className="text-xs text-muted-foreground">{children}</span>
      </span>
    </ToggleGroupItem>
  );
}

/**
 * The table's details, edited in the side panel or the sheet. Every change stays local until
 * "Save table" (or "Add table"), which submits the form.
 */
export function TableEditorForm({
  editor,
  savedTable,
  tables,
  zones,
  lookup,
  onChange,
  onSubmit,
  className,
}: {
  editor: TableEditor;
  /** Latest saved copy of the table, for the bookable and joining reasons. */
  savedTable: TableInventory | null;
  tables: ReadonlyArray<TableInventory>;
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'name' | 'active'>>;
  lookup: TableZoneLookup;
  onChange: (patch: Partial<TableDraft>) => void;
  onSubmit: () => void;
  className?: string;
}) {
  const { draft, errors } = editor;
  const [detailsOpen, setDetailsOpen] = useState(
    () => draft.status === 'out_of_service' || Boolean(draft.notes || draft.section),
  );

  // Errors in the optional details open them so the field can be seen and focused.
  useEffect(() => {
    if (errors.section || errors.notes) setDetailsOpen(true);
  }, [errors.notes, errors.section]);

  useEffect(() => {
    document.getElementById(fieldId('tableNumber'))?.focus({ preventScroll: true });
  }, [editor.session]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const seats = Number.parseInt(draft.capacity, 10);
  const stepSeats = (step: number) => {
    const current = Number.isNaN(seats) ? 0 : seats;
    const next = Math.max(
      TABLE_FORM_LIMITS.seatsMin,
      Math.min(TABLE_FORM_LIMITS.seatsMax, current + step),
    );
    onChange({ capacity: String(next) });
  };
  const status = savedTable ? getTableBookingStatus(savedTable, lookup) : null;
  const savedZoneName = savedTable
    ? (zones.find((zone) => zone.id === savedTable.zoneId)?.name ?? '')
    : '';

  return (
    <FormRoot
      id={TABLE_EDITOR_FORM_ID}
      noValidate
      onSubmit={handleSubmit}
      className={cn('grid content-start gap-3.5', className)}
    >
      {savedTable && status ? (
        <>
          <Reason
            testId="bookable-reason"
            icon={
              status.bookable ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Minus className="size-4" aria-hidden />
              )
            }
          >
            <b>{status.bookable ? 'Bookable' : 'Not bookable'}.</b>{' '}
            {status.bookable
              ? `Can be given to bookings for parties of ${savedTable.minPartySize || 1}–${getTableLargestParty(savedTable)}.`
              : status.reason === 'turned-off'
                ? 'Turned off. It isn’t given to bookings until you turn it back on.'
                : status.reason === 'zone-out-of-service'
                  ? `${savedZoneName} is out of service, so its tables aren’t given to bookings.`
                  : 'Marked out of service. Bookings can’t be assigned to it.'}
          </Reason>
          <JoinReason table={savedTable} tables={tables} lookup={lookup} zoneName={savedZoneName} />
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 content-start gap-1">
          <Label htmlFor={fieldId('tableNumber')} className="text-[13px]">
            Table number
          </Label>
          <Input
            id={fieldId('tableNumber')}
            value={draft.tableNumber}
            onChange={(event) => onChange({ tableNumber: event.target.value })}
            maxLength={TABLE_FORM_LIMITS.tableNumberMax}
            autoComplete="off"
            className={TABLE_TOUCH_TARGET_CLASS}
            aria-invalid={errors.tableNumber ? true : undefined}
            aria-describedby={describedBy(errors.tableNumber && 'tf-tableNumber-error')}
          />
          <TableFieldError id="tf-tableNumber-error" message={errors.tableNumber} />
        </div>
        <div className="grid min-w-0 content-start gap-1">
          <Label htmlFor={fieldId('capacity')} className="text-[13px]">
            Seats
          </Label>
          <div className="flex max-w-[180px] items-stretch">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One seat fewer"
              onClick={() => stepSeats(-1)}
              className="min-h-0 min-w-0 shrink-0 rounded-r-none shadow-none [@media(pointer:coarse)]:size-11"
            >
              <Minus aria-hidden />
            </Button>
            <Input
              id={fieldId('capacity')}
              inputMode="numeric"
              value={draft.capacity}
              onChange={(event) => onChange({ capacity: event.target.value })}
              className="min-w-0 rounded-none border-x-0 text-center tabular-nums [@media(pointer:coarse)]:h-11"
              aria-invalid={errors.capacity ? true : undefined}
              aria-describedby={describedBy(errors.capacity && 'tf-capacity-error')}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One seat more"
              onClick={() => stepSeats(1)}
              className="min-h-0 min-w-0 shrink-0 rounded-l-none shadow-none [@media(pointer:coarse)]:size-11"
            >
              <Plus aria-hidden />
            </Button>
          </div>
          <TableFieldError id="tf-capacity-error" message={errors.capacity} />
        </div>
      </div>

      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-1 text-[13px] font-semibold">Party sizes it takes</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid min-w-0 content-start gap-1">
            <Label htmlFor={fieldId('minPartySize')} className="text-[13px]">
              Smallest
            </Label>
            <Input
              id={fieldId('minPartySize')}
              inputMode="numeric"
              value={draft.minPartySize}
              onChange={(event) => onChange({ minPartySize: event.target.value })}
              className={cn('tabular-nums', TABLE_TOUCH_TARGET_CLASS)}
              aria-invalid={errors.minPartySize ? true : undefined}
              aria-describedby={describedBy(errors.minPartySize && 'tf-minPartySize-error')}
            />
            <TableFieldError id="tf-minPartySize-error" message={errors.minPartySize} />
          </div>
          <div className="grid min-w-0 content-start gap-1">
            <Label htmlFor={fieldId('maxPartySize')} className="text-[13px]">
              Largest
            </Label>
            <Input
              id={fieldId('maxPartySize')}
              inputMode="numeric"
              value={draft.maxPartySize}
              onChange={(event) => onChange({ maxPartySize: event.target.value })}
              placeholder={`Same as seats (${draft.capacity || '–'})`}
              className={cn('tabular-nums', TABLE_TOUCH_TARGET_CLASS)}
              aria-invalid={errors.maxPartySize ? true : undefined}
              aria-describedby={describedBy(errors.maxPartySize && 'tf-maxPartySize-error')}
            />
            <TableFieldError id="tf-maxPartySize-error" message={errors.maxPartySize} />
          </div>
        </div>
      </fieldset>

      <div className="grid min-w-0 gap-1">
        <Label htmlFor={fieldId('zoneId')} className="text-[13px]">
          Zone
        </Label>
        <Select value={draft.zoneId} onValueChange={(zoneId) => onChange({ zoneId })}>
          <SelectTrigger
            id={fieldId('zoneId')}
            className={cn('w-full', TABLE_TOUCH_TARGET_CLASS)}
            aria-invalid={errors.zoneId ? true : undefined}
            aria-describedby={describedBy(errors.zoneId && 'tf-zoneId-error')}
          >
            <SelectValue placeholder="Choose a zone" />
          </SelectTrigger>
          <SelectContent>
            {zones.map((zone) => (
              <SelectItem key={zone.id} value={zone.id}>
                {zone.name}
                {zone.active ? '' : ' (out of service)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TableFieldError id="tf-zoneId-error" message={errors.zoneId} />
      </div>

      <fieldset className="grid min-w-0 gap-2" data-testid="table-joining">
        <legend className="mb-1 text-[13px] font-semibold">Joining with other tables</legend>
        <ToggleGroup
          type="single"
          value={draft.mobility === 'fixed' ? 'fixed' : 'movable'}
          onValueChange={(value) => {
            if (value === 'fixed' || value === 'movable') onChange({ mobility: value });
          }}
          className="grid gap-2"
        >
          <MobilityOption value="movable" checked={draft.mobility !== 'fixed'} title="Movable">
            Can be joined with other movable tables in this zone for bigger parties, up to{' '}
            {TABLE_JOIN_MAX_TABLES} together.
          </MobilityOption>
          <MobilityOption value="fixed" checked={draft.mobility === 'fixed'} title="Fixed">
            Always used on its own. The largest party is its seats.
          </MobilityOption>
        </ToggleGroup>
      </fieldset>

      <Label className="inline-flex min-h-9 cursor-pointer items-center gap-2.5 font-medium [@media(pointer:coarse)]:min-h-11">
        <Switch
          id={fieldId('active')}
          checked={draft.active}
          onCheckedChange={(active) => onChange({ active })}
          className={SWITCH_SIZE_CLASS}
        />
        <span>Can be given to bookings</span>
      </Label>

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger
          className={cn(
            'group -ml-1 inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
            TABLE_TOUCH_TARGET_CLASS,
          )}
        >
          <ChevronRight
            className="size-4 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
            aria-hidden
          />
          Details and notes{' '}
          <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </CollapsibleTrigger>
        <CollapsibleContent forceMount className="data-[state=closed]:hidden">
          <div className="mt-2 grid gap-3">
            <div className="grid min-w-0 gap-1">
              <Label htmlFor={fieldId('status')} className="text-[13px]">
                Service status
              </Label>
              <OptionSelect
                id={fieldId('status')}
                value={draft.status}
                options={STATUS_OPTIONS}
                onChange={(value) => onChange({ status: value })}
                describedById="tf-status-hint"
              />
              <p id="tf-status-hint" className="text-xs text-muted-foreground">
                Only “Out of service” stops bookings being assigned.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 content-start gap-1">
                <Label htmlFor={fieldId('seatingType')} className="text-[13px]">
                  Seating
                </Label>
                <OptionSelect
                  id={fieldId('seatingType')}
                  value={draft.seatingType}
                  options={SEATING_TYPE_OPTIONS}
                  onChange={(value) => onChange({ seatingType: value })}
                />
              </div>
              <div className="grid min-w-0 content-start gap-1">
                <Label htmlFor={fieldId('category')} className="text-[13px]">
                  Category
                </Label>
                <OptionSelect
                  id={fieldId('category')}
                  value={draft.category}
                  options={CATEGORY_OPTIONS}
                  onChange={(value) => onChange({ category: value })}
                />
              </div>
              <div className="grid min-w-0 content-start gap-1">
                <Label htmlFor={fieldId('section')} className="text-[13px]">
                  Section
                </Label>
                <Input
                  id={fieldId('section')}
                  value={draft.section}
                  onChange={(event) => onChange({ section: event.target.value })}
                  placeholder="e.g. By the window"
                  maxLength={TABLE_FORM_LIMITS.sectionMax}
                  className={TABLE_TOUCH_TARGET_CLASS}
                  aria-invalid={errors.section ? true : undefined}
                  aria-describedby={describedBy(errors.section && 'tf-section-error')}
                />
                <TableFieldError id="tf-section-error" message={errors.section} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Seating, category and section are for your records. They don’t change which bookings a
              table gets.
            </p>
            <div className="grid min-w-0 gap-1">
              <Label htmlFor={fieldId('notes')} className="text-[13px]">
                Notes
              </Label>
              <Textarea
                id={fieldId('notes')}
                value={draft.notes}
                onChange={(event) => onChange({ notes: event.target.value })}
                maxLength={TABLE_FORM_LIMITS.notesMax}
                rows={3}
                aria-invalid={errors.notes ? true : undefined}
                aria-describedby={describedBy(errors.notes && 'tf-notes-error')}
              />
              <TableFieldError id="tf-notes-error" message={errors.notes} />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </FormRoot>
  );
}

export function TableEditorFooter({
  isNew,
  canDelete,
  isSaving,
  onDelete,
  onClose,
}: {
  isNew: boolean;
  canDelete: boolean;
  isSaving: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {!isNew && canDelete ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onDelete}
          className={TABLE_TOUCH_TARGET_CLASS}
        >
          <Trash2 aria-hidden /> Delete
        </Button>
      ) : (
        <span />
      )}
      <span className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className={TABLE_TOUCH_TARGET_CLASS}
        >
          {isNew ? 'Cancel' : 'Close'}
        </Button>
        <Button
          type="submit"
          form={TABLE_EDITOR_FORM_ID}
          disabled={isSaving}
          className={TABLE_TOUCH_TARGET_CLASS}
        >
          {isSaving ? 'Saving…' : isNew ? 'Add table' : 'Save table'}
        </Button>
      </span>
    </>
  );
}
