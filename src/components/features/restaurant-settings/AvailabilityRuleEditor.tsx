import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { MONTH_OPTIONS, describeRuleDraft, type RuleDraft } from './availabilityOccasionsModel';
import { RestaurantSettingsDatePickerField } from './RestaurantSettingsDatePickerField';

export type AvailabilityRuleEditorProps = {
  canRemove: boolean;
  index: number;
  rule: RuleDraft;
  onAddSpecificDate: (ruleId: string) => void;
  onRemove: (ruleId: string) => void;
  onRemoveSpecificDate: (ruleId: string, date: string) => void;
  onReplaceKind: (ruleId: string, kind: RuleDraft['kind']) => void;
  onToggleMonth: (ruleId: string, month: number) => void;
  onUpdate: (ruleId: string, patch: Partial<RuleDraft>) => void;
};

export function AvailabilityRuleEditor({
  canRemove,
  index,
  rule,
  onAddSpecificDate,
  onRemove,
  onRemoveSpecificDate,
  onReplaceKind,
  onToggleMonth,
  onUpdate,
}: AvailabilityRuleEditorProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Rule {index + 1}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(rule.id)}
          disabled={!canRemove}
        >
          <Trash2 data-icon="inline-start" aria-hidden />
          Remove
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Rule type</Label>
        <Select
          value={rule.kind}
          onValueChange={(value) => onReplaceKind(rule.id, value as RuleDraft['kind'])}
        >
          <SelectTrigger aria-label={`Rule ${index + 1} type`}>
            <SelectValue placeholder="Choose a rule type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="anytime">Always available</SelectItem>
              <SelectItem value="time_window">Only during a time window</SelectItem>
              <SelectItem value="month_only">Only in selected months</SelectItem>
              <SelectItem value="date_range">Only in a date range</SelectItem>
              <SelectItem value="specific_dates">Only on specific dates</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {rule.kind === 'anytime' ? (
        <p className="text-sm text-muted-foreground">
          Guests can choose this occasion at any time the restaurant is taking bookings.
        </p>
      ) : null}

      {rule.kind === 'time_window' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label>Start time</Label>
            <Input
              type="time"
              value={rule.start}
              onChange={(event) => onUpdate(rule.id, { start: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>End time</Label>
            <Input
              type="time"
              value={rule.end}
              onChange={(event) => onUpdate(rule.id, { end: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      {rule.kind === 'month_only' ? (
        <div className="flex flex-col gap-2">
          <Label>Available months</Label>
          <div className="flex flex-wrap gap-2">
            {MONTH_OPTIONS.map((month) => {
              const selected = rule.months.includes(month.value);
              return (
                <Button
                  key={month.value}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onToggleMonth(rule.id, month.value)}
                >
                  {month.label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {rule.kind === 'date_range' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <RestaurantSettingsDatePickerField
            label="Start date"
            value={rule.rangeStart}
            onChange={(rangeStart) => onUpdate(rule.id, { rangeStart })}
          />
          <RestaurantSettingsDatePickerField
            label="End date"
            value={rule.rangeEnd}
            onChange={(rangeEnd) => onUpdate(rule.id, { rangeEnd })}
          />
        </div>
      ) : null}

      {rule.kind === 'specific_dates' ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <RestaurantSettingsDatePickerField
              label="Add date"
              value={rule.pendingDate}
              onChange={(pendingDate) => onUpdate(rule.id, { pendingDate })}
              className="min-w-[180px] flex-1"
            />
            <Button type="button" variant="outline" onClick={() => onAddSpecificDate(rule.id)}>
              Add date
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {rule.specificDates.map((date) => (
              <Button
                key={date}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRemoveSpecificDate(rule.id, date)}
                className="h-auto rounded-full px-3 py-1 text-sm text-foreground hover:border-destructive/40 hover:bg-destructive/5"
              >
                {date}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">Preview: {describeRuleDraft(rule)}</p>
    </div>
  );
}
