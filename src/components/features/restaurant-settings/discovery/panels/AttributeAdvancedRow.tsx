'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

import {
  AttributeAdvancedGuestValueFields,
  AttributeAdvancedJsonFields,
  AttributeAdvancedScalarValueFields,
  AttributeAdvancedTextFields,
} from './AttributeAdvancedFieldSections';
import { getAttributeAdvancedRowDisplayState } from './attributesPanelDomain';
import { type AttributeEditor } from '../../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function AttributeAdvancedRow({
  row,
  editor,
  onRemove,
}: {
  row: AttributeEditor;
  editor: Pick<RestaurantBusinessContextEditor, 'updateAttribute'>;
  onRemove: () => void;
}) {
  const display = getAttributeAdvancedRowDisplayState(row);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Text variant="label" className="truncate">
            {display.title}
          </Text>
          <Text
            variant="caption"
            className={display.subtitleIsKey ? 'truncate font-mono' : 'truncate'}
          >
            {display.subtitle}
          </Text>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove ${display.title}`}
          onClick={onRemove}
        >
          <Trash2 data-icon="inline-start" aria-hidden />
          Remove
        </Button>
      </div>
      <AttributeAdvancedTextFields row={row} editor={editor} />
      <AttributeAdvancedScalarValueFields row={row} editor={editor} />
      <AttributeAdvancedGuestValueFields row={row} editor={editor} />
      <AttributeAdvancedJsonFields row={row} editor={editor} />
    </div>
  );
}
