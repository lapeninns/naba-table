'use client';

import { Image as ImageIcon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold">Google publishing</h3>
      </div>
      <Text variant="caption" className="mt-1">
        Select or paste GBP media keys for publishing. Local image URLs stay Nabatable-only.
      </Text>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3 rounded-md border bg-muted/20 p-3">
          <div className="flex gap-2">
            <Input
              value={mediaKeyDraft}
              onChange={(event) => onMediaKeyDraftChange(event.target.value)}
              placeholder="locations/{locationId}/media/{mediaKey}"
            />
            <Button type="button" variant="outline" onClick={onAddMediaKey}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {mediaKeys.length > 0 ? (
              mediaKeys.map((mediaKey) => (
                <Badge key={mediaKey} variant="secondary" className="max-w-full gap-2 px-2 py-1">
                  <span className="max-w-64 truncate">{mediaKey}</span>
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
              <Text as="span" variant="caption">No GBP media keys selected.</Text>
            )}
          </div>
          <Field label="Manual paste fallback">
            <Textarea
              value={state.googleMediaKeys}
              onChange={(event) => patch(setState, { googleMediaKeys: event.target.value })}
              placeholder="One Google media key per line"
            />
          </Field>
        </div>
        <Field label="Local image URL">
          <Input
            value={state.localImageUrl}
            onChange={(event) => patch(setState, { localImageUrl: event.target.value })}
            placeholder="/uploads/menu/example.jpg"
          />
        </Field>
      </div>
      {mediaError ? <Text variant="caption" className="mt-3 text-destructive">{mediaError}</Text> : null}
    </div>
  );
}
