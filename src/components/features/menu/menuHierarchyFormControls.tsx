'use client';

import { AlertCircle, ChevronDown } from 'lucide-react';
import { Children, cloneElement, isValidElement, useId, type ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { menuErrorReasonCode } from './menuMutationFeedback';

const LABELABLE_CONTROLS = new Set<unknown>([Input, Textarea]);

/**
 * Labelled form row. A single Input/Textarea child is linked with `htmlFor`/`id`; any other
 * content (Select, paired range inputs) is exposed as a group named by the label.
 */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const only = Children.count(children) === 1 ? Children.only(children) : null;
  const linkable =
    isValidElement<{ id?: string; 'aria-describedby'?: string }>(only) &&
    LABELABLE_CONTROLS.has(only.type)
      ? only
      : null;
  const describedBy =
    [linkable?.props['aria-describedby'], hintId].filter(Boolean).join(' ') || undefined;
  const controlId = linkable?.props.id ?? `${baseId}-control`;

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Label
        id={labelId}
        htmlFor={linkable ? controlId : undefined}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </Label>
      {linkable ? (
        cloneElement(linkable, { id: controlId, 'aria-describedby': describedBy })
      ) : (
        <div
          role="group"
          aria-labelledby={labelId}
          aria-describedby={hintId}
          className="flex min-w-0 flex-col gap-2"
        >
          {children}
        </div>
      )}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SwitchField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 p-3">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function NutritionRangeInputs({
  lowerValue,
  upperValue,
  unit,
  onLowerChange,
  onUpperChange,
}: {
  lowerValue: string;
  upperValue: string;
  unit: string;
  onLowerChange: (value: string) => void;
  onUpperChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Input
        type="number"
        min="0"
        value={lowerValue}
        onChange={(event) => onLowerChange(event.target.value)}
        placeholder={`Lower ${unit}`}
        aria-label={`Lower ${unit}`}
      />
      <Input
        type="number"
        min="0"
        value={upperValue}
        onChange={(event) => onUpperChange(event.target.value)}
        placeholder={`Upper ${unit}`}
        aria-label={`Upper ${unit}`}
      />
    </div>
  );
}

export function MultiCheckboxGroup({
  label,
  options,
  values,
  onChange,
  getOptionLabel = (option) => option,
  hint,
  className,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  values: string[];
  onChange: (value: string, checked: boolean) => void;
  getOptionLabel?: (value: string) => string;
  className?: string;
}) {
  const labelId = useId();
  const hintId = `${labelId}-hint`;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      className={cn('flex flex-col gap-2', className)}
    >
      <span id={labelId} className="text-sm font-medium text-foreground">
        {label}
      </span>
      {hint ? (
        <span id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Label
            key={option}
            className="flex min-h-10 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
          >
            <Checkbox
              checked={values.includes(option)}
              onCheckedChange={(checked) => onChange(option, checked === true)}
            />
            <span>{getOptionLabel(option)}</span>
          </Label>
        ))}
      </div>
    </div>
  );
}

/**
 * Collapsed group of less-used fields inside a menu dialog. Content unmounts while closed; the
 * form state lives in the dialog, so nothing is lost.
 */
export function FieldDisclosure({
  title,
  hint,
  open,
  onOpenChange,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
      className="rounded-lg border border-border/70"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="group h-auto min-h-11 w-full items-center justify-between gap-3 whitespace-normal rounded-lg px-3 py-2 text-left"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{title}</span>
            {hint ? (
              <span className="text-xs font-normal text-muted-foreground">{hint}</span>
            ) : null}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t border-border/60 p-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Save failure inside a menu dialog: the draft is kept and only the safe reason code shows. */
export function DialogSaveError({
  error,
  message = 'Not saved. Your edits are still in this dialog.',
}: {
  error: unknown;
  message?: string;
}) {
  if (!error) return null;
  const code = menuErrorReasonCode(error);
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden />
      <AlertDescription>
        {message}
        {code ? (
          <>
            {' '}
            Reason code <span className="font-mono">{code}</span>.
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** Dialog footer: the save error sits directly above Cancel/Save so it is never scrolled away. */
export function DialogFooterActions({ error, children }: { error?: unknown; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <DialogSaveError error={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
    </div>
  );
}
