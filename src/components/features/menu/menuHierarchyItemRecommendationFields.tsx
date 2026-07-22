'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

import { type ItemFormState } from './menuHierarchyDomain';
import { Field, SwitchField } from './menuHierarchyFormControls';
import { patchItemState, type ItemStateSetter } from './menuHierarchyItemOperationalFieldHelpers';

export function RecommendationFields({
  setState,
  state,
}: {
  readonly setState: ItemStateSetter;
  readonly state: ItemFormState;
}) {
  return (
    <div className="rounded-md border p-4">
      <Text variant="subheading" as="h3">Recommendations</Text>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SwitchField
          label="Featured"
          checked={state.featured}
          onCheckedChange={(checked) => patchItemState(setState, { featured: checked })}
        />
        <SwitchField
          label="Signature"
          checked={state.signature}
          onCheckedChange={(checked) => patchItemState(setState, { signature: checked })}
        />
        <Field label="Popularity score">
          <Input
            type="number"
            min="0"
            max="100"
            value={state.popularityScore}
            onChange={(event) => patchItemState(setState, { popularityScore: event.target.value })}
          />
        </Field>
        <Field label="Recommendation tags">
          <Input
            value={state.recommendationTags}
            onChange={(event) =>
              patchItemState(setState, { recommendationTags: event.target.value })
            }
            placeholder="staff pick, pairs with curry"
          />
        </Field>
      </div>
      <Field label="Pairing notes" className="mt-4">
        <Textarea
          value={state.pairingNotes}
          onChange={(event) => patchItemState(setState, { pairingNotes: event.target.value })}
        />
      </Field>
    </div>
  );
}
