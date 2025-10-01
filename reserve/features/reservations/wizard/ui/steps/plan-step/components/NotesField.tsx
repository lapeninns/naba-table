'use client';

import React, { useMemo } from 'react';

import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@shared/ui/form';
import { Textarea } from '@shared/ui/textarea';

const DESCRIPTION = 'Optional. Share anything we should know before you arrive.';
const MAX_LENGTH = 500;

export type NotesFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function NotesField({ value, onChange, error }: NotesFieldProps) {
  const lengthLabel = useMemo(() => `${value.length} / ${MAX_LENGTH}`, [value.length]);

  return (
    <FormItem className="space-y-3">
      <FormLabel htmlFor="notes">Notes</FormLabel>
      <FormControl>
        <Textarea
          id="notes"
          placeholder="Birthday, accessibility needs, allergies…"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          spellCheck
        />
      </FormControl>
      <FormDescription>{DESCRIPTION}</FormDescription>
      <div className="text-right text-xs text-srx-ink-soft" aria-live="polite">
        {lengthLabel}
      </div>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}
