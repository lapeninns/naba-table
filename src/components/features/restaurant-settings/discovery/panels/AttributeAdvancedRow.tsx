'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

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
}: {
  row: AttributeEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  const display = getAttributeAdvancedRowDisplayState(row);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{display.title}</p>
          <p className="truncate text-xs text-muted-foreground">{display.subtitle}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.removeAttribute(row.id)}
        >
          <Trash2 className="size-4" />
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
