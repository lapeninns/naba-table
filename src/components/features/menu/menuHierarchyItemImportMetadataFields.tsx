'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { type ItemFormState } from './menuHierarchyDomain';
import { Field } from './menuHierarchyFormControls';
import { patchItemState, type ItemStateSetter } from './menuHierarchyItemOperationalFieldHelpers';

export function ImportMetadataFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="rounded-md border p-4">
      <h3 className="text-sm font-semibold">Import metadata</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Source system">
          <Input
            value={state.sourceSystem}
            onChange={(event) => patchItemState(setState, { sourceSystem: event.target.value })}
          />
        </Field>
        <Field label="Source item ID">
          <Input
            value={state.sourceItemId}
            onChange={(event) => patchItemState(setState, { sourceItemId: event.target.value })}
          />
        </Field>
        <Field label="Imported at">
          <Input
            value={state.importedAt}
            onChange={(event) => patchItemState(setState, { importedAt: event.target.value })}
            placeholder="2026-05-08T12:00:00Z"
          />
        </Field>
      </div>
      <Field label="Source note" className="mt-4">
        <Textarea
          value={state.sourceNote}
          onChange={(event) => patchItemState(setState, { sourceNote: event.target.value })}
        />
      </Field>
    </div>
  );
}
