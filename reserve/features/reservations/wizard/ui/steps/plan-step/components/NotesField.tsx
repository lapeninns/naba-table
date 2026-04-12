'use client';

import { MessageSquareIcon } from 'lucide-react';
import React, { useId, useMemo } from 'react';

import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@shared/ui/form';
import { Textarea } from '@shared/ui/textarea';

const DESCRIPTION = 'Optional. Share anything we should know before you arrive.';
const MAX_LENGTH = 500;

export type NotesFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  error?: string;
};

export function NotesField({ value, onChange, onBlur, error }: NotesFieldProps) {
  const notesId = useId();
  const lengthLabel = useMemo(() => `${value.length} / ${MAX_LENGTH}`, [value.length]);
  const isNearLimit = value.length > MAX_LENGTH * 0.9;

  return (
    <FormItem className="space-y-2.5">
      <FormLabel
        htmlFor={notesId}
        className="flex items-center gap-1.5 text-sm font-semibold sm:text-base"
      >
        <MessageSquareIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>Notes</span>
      </FormLabel>
      <FormControl>
        <Textarea
          id={notesId}
          placeholder="Birthday, accessibility needs, allergies…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            onBlur?.(event.target.value);
          }}
          rows={3}
          spellCheck
          className="luminous-input resize-none text-base sm:text-sm"
          maxLength={MAX_LENGTH}
        />
      </FormControl>
      <div className="flex items-center justify-between gap-2">
        <FormDescription className="text-xs sm:text-sm">{DESCRIPTION}</FormDescription>
        <div
          className={`text-xs font-medium tabular-nums transition-colors ${
            isNearLimit ? 'text-destructive' : 'text-muted-foreground'
          }`}
          aria-live="polite"
          aria-atomic="true"
        >
          {lengthLabel}
        </div>
      </div>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
