'use client';

import { TriangleAlert } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  FIELD_HELP,
  FIELD_LABELS,
  MULTILINE_FIELDS,
  counterState,
  isRequiredField,
  type VariantField,
} from './model/emailTemplateEditorModel';

export function emailTemplateFieldId(field: VariantField) {
  return `email-template-field-${field}`;
}

export type EmailTemplateFieldProps = {
  field: VariantField;
  value: string;
  /** Shown instead of the help line. */
  error: string | null;
  readOnly: boolean;
  onChange: (value: string) => void;
  /** The field variables are inserted into follows focus. */
  onFocus?: () => void;
};

export function EmailTemplateField({
  field,
  value,
  error,
  readOnly,
  onChange,
  onFocus,
}: EmailTemplateFieldProps) {
  const id = emailTemplateFieldId(field);
  const describedBy = `${id}-note`;
  const counter = counterState(field, value);
  const help = FIELD_HELP[field];
  const shared = {
    id,
    value,
    readOnly,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    autoComplete: 'off',
    onFocus,
    className: cn(readOnly && 'bg-muted/60'),
  } as const;

  return (
    <div className="grid min-w-0 gap-1.5" data-field={field}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {FIELD_LABELS[field]}
          {isRequiredField(field) ? null : (
            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </Label>
        <span
          className={cn(
            'whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground',
            counter.tone === 'low' && 'font-semibold text-foreground',
            counter.tone === 'over' && 'font-semibold text-destructive',
          )}
        >
          {counter.text}
        </span>
      </div>
      {MULTILINE_FIELDS.has(field) ? (
        <Textarea
          {...shared}
          rows={field === 'intro' ? 4 : 2}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input {...shared} onChange={(event) => onChange(event.target.value)} />
      )}
      <div id={describedBy}>
        {error ? (
          <p className="flex items-start gap-1.5 text-xs font-semibold text-destructive">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : help ? (
          <p className="text-xs text-muted-foreground">{help}</p>
        ) : null}
      </div>
    </div>
  );
}
