'use client';

import { Plus, Trash2 } from 'lucide-react';
import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import {
  buildMenuItemPayload,
  createEmptyMenuItemFormState,
  createEmptyModifierGroupFormState,
  createEmptyModifierOptionFormState,
  createMenuItemFormState,
  type MenuItemFormState,
} from './menuFormState';
import { MenuSuggestionInput } from './MenuSuggestionInput';

import type { MenuFacetSet, MenuItemDetail, MenuItemUpsertInput } from '@/server/menu/types';
import type { ReactElement, ReactNode } from 'react';

export function MenuItemSheet({
  open,
  onOpenChange,
  isExistingItem,
  item,
  loadError,
  isLoading,
  isSaving,
  facets,
  onDirtyChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isExistingItem: boolean;
  item: MenuItemDetail | null;
  loadError?: string | null;
  isLoading: boolean;
  isSaving: boolean;
  facets: MenuFacetSet;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (payload: MenuItemUpsertInput) => Promise<void>;
}) {
  const [form, setForm] = useState<MenuItemFormState>(createEmptyMenuItemFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const loadedSourceKeyRef = useRef<string>('new');
  const baselineSnapshotRef = useRef<string>(JSON.stringify(createEmptyMenuItemFormState()));
  const sourceKey = isExistingItem ? (item?.id ?? 'edit-pending') : 'new';
  const currentSnapshot = useMemo(() => JSON.stringify(form), [form]);
  const isDirty = currentSnapshot !== baselineSnapshotRef.current;
  const hasLoadError = Boolean(loadError);
  const canEditForm = !isExistingItem || Boolean(item);

  useEffect(() => {
    if (!open) return;
    if (isExistingItem && !item) {
      return;
    }

    if (loadedSourceKeyRef.current !== sourceKey || !isDirty) {
      const nextForm = createMenuItemFormState(item);
      loadedSourceKeyRef.current = sourceKey;
      baselineSnapshotRef.current = JSON.stringify(nextForm);
      setForm(nextForm);
      if (!hasLoadError) {
        setFormError(null);
      }
    }
  }, [item, open, sourceKey, isDirty, isExistingItem, hasLoadError]);

  useEffect(() => {
    onDirtyChange?.(open && isDirty);
  }, [isDirty, onDirtyChange, open]);

  const updateField = <K extends keyof MenuItemFormState>(key: K, value: MenuItemFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canEditForm || hasLoadError) {
      return;
    }

    try {
      setFormError(null);
      const payload = buildMenuItemPayload(form);
      await onSubmit(payload);
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the menu item');
    }
  };

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setDiscardDialogOpen(true);
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleCancel = () => {
    if (isDirty) {
      setDiscardDialogOpen(true);
      return;
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>{isExistingItem ? 'Edit menu item' : 'New menu item'}</SheetTitle>
          <SheetDescription>
            Manage the item metadata, availability, and modifier structure for the active
            restaurant.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading item details…</div>
          ) : hasLoadError ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load menu item</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to save</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <FormSection
                title="Basics"
                description="Core identity, categorization, price, and availability."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Item name">
                    <Input
                      value={form.itemName}
                      onChange={(event) => updateField('itemName', event.target.value)}
                    />
                  </Field>
                  <Field label="Category">
                    <MenuSuggestionInput
                      value={form.category}
                      suggestions={facets.categories}
                      onValueChange={(value) => updateField('category', value)}
                    />
                  </Field>
                  <Field label="Subcategory">
                    <MenuSuggestionInput
                      value={form.subcategory}
                      suggestions={facets.subcategories}
                      onValueChange={(value) => updateField('subcategory', value)}
                    />
                  </Field>
                  <Field label="Base price">
                    <Input
                      value={form.basePrice}
                      onChange={(event) => updateField('basePrice', event.target.value)}
                    />
                  </Field>
                  <Field label="Currency">
                    <Input
                      value={form.currency}
                      onChange={(event) =>
                        updateField('currency', event.target.value.toUpperCase())
                      }
                    />
                  </Field>
                  <Field label="Service time">
                    <MenuSuggestionInput
                      value={form.serviceTime}
                      suggestions={facets.serviceTimes}
                      onValueChange={(value) => updateField('serviceTime', value)}
                    />
                  </Field>
                  <Field label="Availability status">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={form.availabilityStatus === 'available' ? 'default' : 'outline'}
                        onClick={() => updateField('availabilityStatus', 'available')}
                      >
                        Available
                      </Button>
                      <Button
                        type="button"
                        variant={form.availabilityStatus === 'unavailable' ? 'default' : 'outline'}
                        onClick={() => updateField('availabilityStatus', 'unavailable')}
                      >
                        Unavailable
                      </Button>
                    </div>
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Descriptions"
                description="Short and long-form guest-facing copy."
              >
                <div className="grid gap-4">
                  <Field label="Short description">
                    <Textarea
                      value={form.shortDescription}
                      onChange={(event) => updateField('shortDescription', event.target.value)}
                      rows={2}
                    />
                  </Field>
                  <Field label="Full description">
                    <Textarea
                      value={form.fullDescription}
                      onChange={(event) => updateField('fullDescription', event.target.value)}
                      rows={4}
                    />
                  </Field>
                  <Field label="Serving notes">
                    <Textarea
                      value={form.servingNotes}
                      onChange={(event) => updateField('servingNotes', event.target.value)}
                      rows={3}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Culinary Profile"
                description="Preparation and ingredient metadata."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Key ingredients">
                    <Textarea
                      value={form.keyIngredients}
                      onChange={(event) => updateField('keyIngredients', event.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field label="Recommendation tags">
                    <Textarea
                      value={form.recommendationTags}
                      onChange={(event) => updateField('recommendationTags', event.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field label="Pairings">
                    <Textarea
                      value={form.pairings}
                      onChange={(event) => updateField('pairings', event.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field label="Removable ingredients">
                    <Textarea
                      value={form.removableIngredients}
                      onChange={(event) => updateField('removableIngredients', event.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field label="Main protein or base">
                    <Input
                      value={form.mainProteinOrBase}
                      onChange={(event) => updateField('mainProteinOrBase', event.target.value)}
                    />
                  </Field>
                  <Field label="Cooking style">
                    <Input
                      value={form.cookingStyle}
                      onChange={(event) => updateField('cookingStyle', event.target.value)}
                    />
                  </Field>
                  <Field label="Preparation method">
                    <Input
                      value={form.preparationMethod}
                      onChange={(event) => updateField('preparationMethod', event.target.value)}
                    />
                  </Field>
                  <Field label="Flavor profile">
                    <Input
                      value={form.flavorProfile}
                      onChange={(event) => updateField('flavorProfile', event.target.value)}
                    />
                  </Field>
                  <Field label="Texture">
                    <Input
                      value={form.texture}
                      onChange={(event) => updateField('texture', event.target.value)}
                    />
                  </Field>
                  <Field label="Spice level">
                    <Input
                      value={form.spiceLevel}
                      onChange={(event) => updateField('spiceLevel', event.target.value)}
                    />
                  </Field>
                  <Field label="Portion size">
                    <Input
                      value={form.portionSize}
                      onChange={(event) => updateField('portionSize', event.target.value)}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Dietary and Allergen Metadata"
                description="Guest-facing dietary and allergen signaling."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Dietary tags">
                    <Textarea
                      value={form.dietaryTags}
                      onChange={(event) => updateField('dietaryTags', event.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field label="Contains allergens">
                    <Textarea
                      value={form.allergensContains}
                      onChange={(event) => updateField('allergensContains', event.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field label="May contain allergens">
                    <Textarea
                      value={form.allergensMayContain}
                      onChange={(event) => updateField('allergensMayContain', event.target.value)}
                      rows={3}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Nutrition and Serves"
                description="Optional per-item nutrition facts and serving count."
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Calories (kcal)">
                    <Input
                      value={form.caloriesKcal}
                      onChange={(event) => updateField('caloriesKcal', event.target.value)}
                    />
                  </Field>
                  <Field label="Protein (g)">
                    <Input
                      value={form.proteinG}
                      onChange={(event) => updateField('proteinG', event.target.value)}
                    />
                  </Field>
                  <Field label="Fat (g)">
                    <Input
                      value={form.fatG}
                      onChange={(event) => updateField('fatG', event.target.value)}
                    />
                  </Field>
                  <Field label="Saturated fat (g)">
                    <Input
                      value={form.saturatedFatG}
                      onChange={(event) => updateField('saturatedFatG', event.target.value)}
                    />
                  </Field>
                  <Field label="Carbs (g)">
                    <Input
                      value={form.carbsG}
                      onChange={(event) => updateField('carbsG', event.target.value)}
                    />
                  </Field>
                  <Field label="Sugar (g)">
                    <Input
                      value={form.sugarG}
                      onChange={(event) => updateField('sugarG', event.target.value)}
                    />
                  </Field>
                  <Field label="Fiber (g)">
                    <Input
                      value={form.fiberG}
                      onChange={(event) => updateField('fiberG', event.target.value)}
                    />
                  </Field>
                  <Field label="Sodium (mg)">
                    <Input
                      value={form.sodiumMg}
                      onChange={(event) => updateField('sodiumMg', event.target.value)}
                    />
                  </Field>
                  <Field label="Serves">
                    <Input
                      value={form.servesNum}
                      onChange={(event) => updateField('servesNum', event.target.value)}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="Customization and Status"
                description="Substitutions, toggles, and lifecycle flags."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Customization rules" className="md:col-span-2">
                    <Textarea
                      value={form.customizationRules}
                      onChange={(event) => updateField('customizationRules', event.target.value)}
                      rows={4}
                    />
                  </Field>
                  <ToggleField
                    label="Spice adjustable"
                    checked={form.spiceAdjustable}
                    onCheckedChange={(checked) => updateField('spiceAdjustable', checked)}
                  />
                  <ToggleField
                    label="Shareable"
                    checked={form.shareable}
                    onCheckedChange={(checked) => updateField('shareable', checked)}
                  />
                  <ToggleField
                    label="Substitutions allowed"
                    checked={form.substitutionsAllowed}
                    onCheckedChange={(checked) => updateField('substitutionsAllowed', checked)}
                  />
                  <ToggleField
                    label="Can be made vegetarian"
                    checked={form.canBeMadeVegetarian}
                    onCheckedChange={(checked) => updateField('canBeMadeVegetarian', checked)}
                  />
                  <ToggleField
                    label="Can be made vegan"
                    checked={form.canBeMadeVegan}
                    onCheckedChange={(checked) => updateField('canBeMadeVegan', checked)}
                  />
                  <ToggleField
                    label="Can be made gluten free"
                    checked={form.canBeMadeGlutenFree}
                    onCheckedChange={(checked) => updateField('canBeMadeGlutenFree', checked)}
                  />
                  <ToggleField
                    label="Active"
                    checked={form.active}
                    onCheckedChange={(checked) => updateField('active', checked)}
                  />
                  <ToggleField
                    label="Seasonal"
                    checked={form.seasonal}
                    onCheckedChange={(checked) => updateField('seasonal', checked)}
                  />
                  <ToggleField
                    label="Limited time"
                    checked={form.limitedTime}
                    onCheckedChange={(checked) => updateField('limitedTime', checked)}
                  />
                  <ToggleField
                    label="Sold out"
                    checked={form.soldOut}
                    onCheckedChange={(checked) => updateField('soldOut', checked)}
                  />
                </div>
              </FormSection>

              <Accordion
                type="single"
                collapsible
                className="rounded-lg border border-border/60 px-4"
              >
                <AccordionItem value="advanced-metadata" className="border-none">
                  <AccordionTrigger className="text-left text-sm font-medium">
                    Import metadata
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="External item ID">
                        <Input
                          value={form.externalItemId}
                          onChange={(event) => updateField('externalItemId', event.target.value)}
                        />
                      </Field>
                      <Field label="Display order">
                        <Input
                          value={form.displayOrder}
                          onChange={(event) => updateField('displayOrder', event.target.value)}
                        />
                      </Field>
                      <Field label="Signature score">
                        <Input
                          value={form.signatureScore}
                          onChange={(event) => updateField('signatureScore', event.target.value)}
                        />
                      </Field>
                      <Field label="Popularity score">
                        <Input
                          value={form.popularityScore}
                          onChange={(event) => updateField('popularityScore', event.target.value)}
                        />
                      </Field>
                      <Field label="Image URL" className="md:col-span-2">
                        <Input
                          value={form.imageUrl}
                          onChange={(event) => updateField('imageUrl', event.target.value)}
                        />
                      </Field>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <FormSection title="Modifiers" description="Nested modifier groups and options.">
                <div className="space-y-4">
                  {form.modifierGroups.map((group, groupIndex) => (
                    <div
                      key={`${group.externalModifierGroupId}-${groupIndex}`}
                      className="rounded-lg border border-border/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-foreground">
                          Modifier group {groupIndex + 1}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              modifierGroups: current.modifierGroups.filter(
                                (_, index) => index !== groupIndex,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove group
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="External group ID">
                          <Input
                            value={group.externalModifierGroupId}
                            onChange={(event) =>
                              setForm((current) => {
                                const next = [...current.modifierGroups];
                                next[groupIndex] = {
                                  ...next[groupIndex],
                                  externalModifierGroupId: event.target.value,
                                };
                                return { ...current, modifierGroups: next };
                              })
                            }
                          />
                        </Field>
                        <Field label="Group name">
                          <Input
                            value={group.groupName}
                            onChange={(event) =>
                              setForm((current) => {
                                const next = [...current.modifierGroups];
                                next[groupIndex] = {
                                  ...next[groupIndex],
                                  groupName: event.target.value,
                                };
                                return { ...current, modifierGroups: next };
                              })
                            }
                          />
                        </Field>
                        <Field label="Min select">
                          <Input
                            value={group.minSelect}
                            onChange={(event) =>
                              setForm((current) => {
                                const next = [...current.modifierGroups];
                                next[groupIndex] = {
                                  ...next[groupIndex],
                                  minSelect: event.target.value,
                                };
                                return { ...current, modifierGroups: next };
                              })
                            }
                          />
                        </Field>
                        <Field label="Max select">
                          <Input
                            value={group.maxSelect}
                            onChange={(event) =>
                              setForm((current) => {
                                const next = [...current.modifierGroups];
                                next[groupIndex] = {
                                  ...next[groupIndex],
                                  maxSelect: event.target.value,
                                };
                                return { ...current, modifierGroups: next };
                              })
                            }
                          />
                        </Field>
                        <Field label="Display order">
                          <Input
                            value={group.displayOrder}
                            onChange={(event) =>
                              setForm((current) => {
                                const next = [...current.modifierGroups];
                                next[groupIndex] = {
                                  ...next[groupIndex],
                                  displayOrder: event.target.value,
                                };
                                return { ...current, modifierGroups: next };
                              })
                            }
                          />
                        </Field>
                        <ToggleField
                          label="Required"
                          checked={group.required}
                          onCheckedChange={(checked) =>
                            setForm((current) => {
                              const next = [...current.modifierGroups];
                              next[groupIndex] = { ...next[groupIndex], required: checked };
                              return { ...current, modifierGroups: next };
                            })
                          }
                        />
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.options.map((option, optionIndex) => (
                          <div
                            key={`${option.externalModifierOptionId}-${optionIndex}`}
                            className="rounded-md border border-border/50 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium text-foreground">
                                Option {optionIndex + 1}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setForm((current) => {
                                    const groups = [...current.modifierGroups];
                                    groups[groupIndex] = {
                                      ...groups[groupIndex],
                                      options: groups[groupIndex].options.filter(
                                        (_, index) => index !== optionIndex,
                                      ),
                                    };
                                    return { ...current, modifierGroups: groups };
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove option
                              </Button>
                            </div>

                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                              <Field label="External option ID">
                                <Input
                                  value={option.externalModifierOptionId}
                                  onChange={(event) =>
                                    setForm((current) =>
                                      updateOption(
                                        current,
                                        groupIndex,
                                        optionIndex,
                                        'externalModifierOptionId',
                                        event.target.value,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                              <Field label="Option name">
                                <Input
                                  value={option.optionName}
                                  onChange={(event) =>
                                    setForm((current) =>
                                      updateOption(
                                        current,
                                        groupIndex,
                                        optionIndex,
                                        'optionName',
                                        event.target.value,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                              <Field label="Price delta">
                                <Input
                                  value={option.priceDelta}
                                  onChange={(event) =>
                                    setForm((current) =>
                                      updateOption(
                                        current,
                                        groupIndex,
                                        optionIndex,
                                        'priceDelta',
                                        event.target.value,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                              <Field label="Display order">
                                <Input
                                  value={option.displayOrder}
                                  onChange={(event) =>
                                    setForm((current) =>
                                      updateOption(
                                        current,
                                        groupIndex,
                                        optionIndex,
                                        'displayOrder',
                                        event.target.value,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                              <ToggleField
                                label="Default selected"
                                checked={option.defaultSelected}
                                onCheckedChange={(checked) =>
                                  setForm((current) =>
                                    updateOption(
                                      current,
                                      groupIndex,
                                      optionIndex,
                                      'defaultSelected',
                                      checked,
                                    ),
                                  )
                                }
                              />
                              <Field label="Availability">
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant={
                                      option.availabilityStatus === 'available'
                                        ? 'default'
                                        : 'outline'
                                    }
                                    onClick={() =>
                                      setForm((current) =>
                                        updateOption(
                                          current,
                                          groupIndex,
                                          optionIndex,
                                          'availabilityStatus',
                                          'available',
                                        ),
                                      )
                                    }
                                  >
                                    Available
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={
                                      option.availabilityStatus === 'unavailable'
                                        ? 'default'
                                        : 'outline'
                                    }
                                    onClick={() =>
                                      setForm((current) =>
                                        updateOption(
                                          current,
                                          groupIndex,
                                          optionIndex,
                                          'availabilityStatus',
                                          'unavailable',
                                        ),
                                      )
                                    }
                                  >
                                    Unavailable
                                  </Button>
                                </div>
                              </Field>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setForm((current) => {
                              const groups = [...current.modifierGroups];
                              groups[groupIndex] = {
                                ...groups[groupIndex],
                                options: [
                                  ...groups[groupIndex].options,
                                  createEmptyModifierOptionFormState(),
                                ],
                              };
                              return { ...current, modifierGroups: groups };
                            })
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add option
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        modifierGroups: [
                          ...current.modifierGroups,
                          createEmptyModifierGroupFormState(),
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add modifier group
                  </Button>
                </div>
              </FormSection>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border/60">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving || isLoading || hasLoadError || !canEditForm}
          >
            {isSaving ? 'Saving…' : 'Save item'}
          </Button>
        </SheetFooter>
      </SheetContent>

      <ConfirmDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title="Discard unsaved menu item changes?"
        description="Any edits to this menu item will be lost. This cannot be undone."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          setDiscardDialogOpen(false);
          onOpenChange(false);
        }}
      />
    </Sheet>
  );
}

function updateOption(
  form: MenuItemFormState,
  groupIndex: number,
  optionIndex: number,
  key: keyof MenuItemFormState['modifierGroups'][number]['options'][number],
  value: string | boolean,
): MenuItemFormState {
  const groups = [...form.modifierGroups];
  const options = [...groups[groupIndex].options];
  options[optionIndex] = {
    ...options[optionIndex],
    [key]: value,
  };
  groups[groupIndex] = {
    ...groups[groupIndex],
    options,
  };
  return {
    ...form,
    modifierGroups: groups,
  };
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/60 p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const childElement = isValidElement(children)
    ? (children as ReactElement<Record<string, unknown>>)
    : null;
  const labelId = useId();
  const controlId = `${labelId}-control`;
  const controlName = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const isGroupedContent =
    childElement && typeof childElement.type === 'string' && childElement.type === 'div';
  const labelledChild = childElement
    ? cloneElement(childElement, {
        id: isGroupedContent ? childElement.props.id : (childElement.props.id ?? controlId),
        name: isGroupedContent ? childElement.props.name : (childElement.props.name ?? controlName),
        'aria-labelledby': childElement.props['aria-labelledby'] ?? labelId,
      })
    : children;

  return (
    <div className={className}>
      <Label
        id={labelId}
        htmlFor={isGroupedContent ? undefined : controlId}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </Label>
      <div className="mt-2">{labelledChild}</div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const labelId = useId();

  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
      <Label id={labelId} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Switch aria-labelledby={labelId} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
