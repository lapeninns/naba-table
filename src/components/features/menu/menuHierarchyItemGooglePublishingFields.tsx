'use client';

import { AlertCircle, XIcon } from 'lucide-react';
import { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

import { type ItemFormState } from './menuHierarchyDomain';
import { Field } from './menuHierarchyFormControls';

import type { Dispatch, SetStateAction } from 'react';

type ItemStateSetter = Dispatch<SetStateAction<ItemFormState>>;

function patch(setState: ItemStateSetter, update: Partial<ItemFormState>) {
  setState((current) => ({ ...current, ...update }));
}

export function GoogleItemPublishingFields({
  mediaError,
  mediaKeyDraft,
  mediaKeys,
  onAddMediaKey,
  onMediaKeyDraftChange,
  onRemoveMediaKey,
  setState,
  state,
}: {
  readonly mediaError: string | null;
  readonly mediaKeyDraft: string;
  readonly mediaKeys: string[];
  readonly onAddMediaKey: () => void;
  readonly onMediaKeyDraftChange: (value: string) => void;
  readonly onRemoveMediaKey: (key: string) => void;
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  const baseId = useId();
  const draftId = `${baseId}-draft`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={draftId} className="text-sm font-medium text-foreground">
          Google photo keys
        </Label>
        <div className="flex gap-2">
          <Input
            id={draftId}
            className="font-mono"
            value={mediaKeyDraft}
            onChange={(event) => onMediaKeyDraftChange(event.target.value)}
            placeholder="locations/{locationId}/media/{mediaKey}"
            aria-invalid={mediaError ? true : undefined}
            aria-describedby={mediaError ? `${hintId} ${errorId}` : hintId}
          />
          <Button type="button" variant="outline" onClick={onAddMediaKey}>
            Add
          </Button>
        </div>
        <Text as="p" id={hintId} variant="caption">
          From your Google photos. Web addresses go in Local image URL instead; they stay in
          Nabatable.
        </Text>
        {mediaError ? (
          <p id={errorId} className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
            {mediaError}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {mediaKeys.length > 0 ? (
          mediaKeys.map((mediaKey) => (
            <Badge key={mediaKey} variant="secondary" className="max-w-full gap-2 px-2 py-1">
              <span className="max-w-64 truncate font-mono">{mediaKey}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 text-muted-foreground hover:text-foreground"
                onClick={() => onRemoveMediaKey(mediaKey)}
                aria-label={`Remove ${mediaKey}`}
              >
                <XIcon data-icon="icon" aria-hidden />
              </Button>
            </Badge>
          ))
        ) : (
          <Text as="span" variant="caption">
            No GBP media keys selected.
          </Text>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Manual paste fallback">
          <Textarea
            className="font-mono"
            value={state.googleMediaKeys}
            onChange={(event) => patch(setState, { googleMediaKeys: event.target.value })}
            placeholder="One Google media key per line"
          />
        </Field>
        <Field label="Local image URL">
          <Input
            value={state.localImageUrl}
            onChange={(event) => patch(setState, { localImageUrl: event.target.value })}
            placeholder="/uploads/menu/example.jpg"
          />
        </Field>
      </div>
    </div>
  );
}
