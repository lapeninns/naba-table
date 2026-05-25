'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatGoogleFoodMenuEnumLabel as formatEnumLabel } from '@/lib/google-food-menu-labels';

import {
  CUISINE_OPTIONS,
  toggleValue,
  type MenuFormState,
  type SectionFormState,
} from './menuHierarchyDomain';
import { Field, MultiCheckboxGroup, SwitchField } from './menuHierarchyFormControls';

import type { MenuKind } from '@/server/menu-hierarchy/types';
import type { Dispatch, SetStateAction } from 'react';

type MenuStateSetter = Dispatch<SetStateAction<MenuFormState>>;
type SectionStateSetter = Dispatch<SetStateAction<SectionFormState>>;

function patchMenu(setState: MenuStateSetter, update: Partial<MenuFormState>) {
  setState((current) => ({ ...current, ...update }));
}

function patchSection(setState: SectionStateSetter, update: Partial<SectionFormState>) {
  setState((current) => ({ ...current, ...update }));
}

export function MenuDialogFields({
  setState,
  state,
}: {
  readonly setState: MenuStateSetter;
  readonly state: MenuFormState;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Menu name">
          <Input
            value={state.displayName}
            onChange={(event) => patchMenu(setState, { displayName: event.target.value })}
            required
          />
        </Field>
        <Field label="Kind">
          <Select
            value={state.menuKind}
            onValueChange={(value) => patchMenu(setState, { menuKind: value as MenuKind })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="drinks">Drinks</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default language">
          <Input
            value={state.defaultLanguageCode}
            onChange={(event) => patchMenu(setState, { defaultLanguageCode: event.target.value })}
          />
        </Field>
        <Field label="Source URL">
          <Input
            type="url"
            value={state.sourceUrl}
            onChange={(event) => patchMenu(setState, { sourceUrl: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Description">
        <Textarea
          value={state.description}
          onChange={(event) => patchMenu(setState, { description: event.target.value })}
        />
      </Field>
      <Field label="Additional Google labels">
        <Textarea
          value={state.additionalLabels}
          onChange={(event) => patchMenu(setState, { additionalLabels: event.target.value })}
          placeholder="fr-FR | Nom du menu | Description"
        />
      </Field>
      <MultiCheckboxGroup
        label="Google cuisines"
        options={CUISINE_OPTIONS}
        getOptionLabel={formatEnumLabel}
        values={state.cuisines}
        onChange={(value, checked) =>
          setState((current) => ({
            ...current,
            cuisines: toggleValue(current.cuisines, value, checked),
          }))
        }
      />
      <SwitchField
        label="Menu active"
        checked={state.active}
        onCheckedChange={(checked) => patchMenu(setState, { active: checked })}
      />
    </>
  );
}

export function SectionDialogFields({
  setState,
  state,
}: {
  readonly setState: SectionStateSetter;
  readonly state: SectionFormState;
}) {
  return (
    <>
      <Field label="Section name">
        <Input
          value={state.displayName}
          onChange={(event) => patchSection(setState, { displayName: event.target.value })}
          required
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={state.description}
          onChange={(event) => patchSection(setState, { description: event.target.value })}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Primary label language">
          <Input
            value={state.languageCode}
            onChange={(event) => patchSection(setState, { languageCode: event.target.value })}
            placeholder="en-GB"
          />
        </Field>
        <Field label="Additional Google labels">
          <Textarea
            value={state.additionalLabels}
            onChange={(event) => patchSection(setState, { additionalLabels: event.target.value })}
            placeholder="fr-FR | Nom de section | Description"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Legacy category">
          <Input
            value={state.legacyCategory}
            onChange={(event) => patchSection(setState, { legacyCategory: event.target.value })}
          />
        </Field>
        <Field label="Legacy subcategory">
          <Input
            value={state.legacySubcategory}
            onChange={(event) => patchSection(setState, { legacySubcategory: event.target.value })}
          />
        </Field>
      </div>
      <SwitchField
        label="Section active"
        checked={state.active}
        onCheckedChange={(checked) => patchSection(setState, { active: checked })}
      />
    </>
  );
}
