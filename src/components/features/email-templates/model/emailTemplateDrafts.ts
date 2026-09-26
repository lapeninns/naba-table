import type { VariantField } from './emailTemplateEditorModel';
import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';

/**
 * Unsaved variants per template. A template has a draft only once it is edited; until then the
 * editor shows the saved variants (`base`). Every action that starts a draft is given `base`.
 */
export type DraftsState = Partial<
  Record<RestaurantBookingEmailTemplateKey, RestaurantEmailTemplateVariant[]>
>;

type Variants = ReadonlyArray<RestaurantEmailTemplateVariant>;

export type DraftAction =
  | {
      type: 'edit';
      key: RestaurantBookingEmailTemplateKey;
      base: Variants;
      variantId: string;
      field: VariantField;
      value: string;
    }
  | {
      type: 'set-live';
      key: RestaurantBookingEmailTemplateKey;
      base: Variants;
      variantId: string;
      isActive: boolean;
    }
  | {
      type: 'add';
      key: RestaurantBookingEmailTemplateKey;
      base: Variants;
      variant: RestaurantEmailTemplateVariant;
    }
  | {
      type: 'move';
      key: RestaurantBookingEmailTemplateKey;
      base: Variants;
      variantId: string;
      direction: -1 | 1;
    }
  | { type: 'delete'; key: RestaurantBookingEmailTemplateKey; base: Variants; variantId: string }
  | { type: 'discard'; key: RestaurantBookingEmailTemplateKey }
  | { type: 'saved'; key: RestaurantBookingEmailTemplateKey; sent: Variants; saved: Variants }
  | { type: 'clear' };

function comparable(variants: Variants) {
  return JSON.stringify(
    [...variants]
      .sort((left, right) => left.order - right.order)
      .map(
        ({
          id,
          name,
          subject,
          preheader,
          headline,
          intro,
          cue,
          ask,
          ctaLabel,
          isActive,
          order,
        }) => [id, name, subject, preheader, headline, intro, cue, ask, ctaLabel, isActive, order],
      ),
  );
}

export function isDraftDirty(draft: Variants | undefined, saved: Variants): boolean {
  return Boolean(draft) && comparable(draft!) !== comparable(saved);
}

function reorder(variants: RestaurantEmailTemplateVariant[]): RestaurantEmailTemplateVariant[] {
  return variants.map((variant, order) =>
    variant.order === order ? variant : { ...variant, order },
  );
}

/**
 * The draft to keep once a save returns: null when nothing changed after the request was sent.
 * Otherwise the server's variants, with every field edited since the send kept as the newer
 * value; variants added after the send are kept as typed, and removed ones stay removed.
 */
function rebaseOnSaved(
  current: Variants | undefined,
  sent: Variants,
  saved: Variants,
): RestaurantEmailTemplateVariant[] | null {
  if (!current || current === sent) return null;
  const sentById = new Map(sent.map((variant) => [variant.id, variant]));
  const savedById = new Map(saved.map((variant) => [variant.id, variant]));
  const rebased = current.map((variant) => {
    const sentVariant = sentById.get(variant.id);
    const savedVariant = savedById.get(variant.id);
    if (!sentVariant || !savedVariant) return variant;
    const next = { ...savedVariant };
    for (const field of Object.keys(next) as Array<keyof RestaurantEmailTemplateVariant>) {
      if (variant[field] !== sentVariant[field]) Object.assign(next, { [field]: variant[field] });
    }
    return next;
  });
  return comparable(rebased) === comparable(saved) ? null : rebased;
}

function withDraft(
  state: DraftsState,
  key: RestaurantBookingEmailTemplateKey,
  base: Variants,
  update: (variants: RestaurantEmailTemplateVariant[]) => RestaurantEmailTemplateVariant[] | null,
): DraftsState {
  const current = state[key] ?? [...base];
  const next = update(current);
  if (!next || next === current) return state;
  return { ...state, [key]: next };
}

function without(state: DraftsState, key: RestaurantBookingEmailTemplateKey): DraftsState {
  if (!(key in state)) return state;
  const next = { ...state };
  delete next[key];
  return next;
}

export function draftsReducer(state: DraftsState, action: DraftAction): DraftsState {
  switch (action.type) {
    case 'edit':
      return withDraft(state, action.key, action.base, (variants) =>
        variants.map((variant) =>
          variant.id === action.variantId ? { ...variant, [action.field]: action.value } : variant,
        ),
      );
    case 'set-live':
      return withDraft(state, action.key, action.base, (variants) =>
        variants.map((variant) =>
          variant.id === action.variantId ? { ...variant, isActive: action.isActive } : variant,
        ),
      );
    case 'add':
      return withDraft(state, action.key, action.base, (variants) =>
        reorder([...variants, action.variant]),
      );
    case 'move':
      return withDraft(state, action.key, action.base, (variants) => {
        const index = variants.findIndex((variant) => variant.id === action.variantId);
        const target = index + action.direction;
        if (index < 0 || target < 0 || target >= variants.length) return null;
        const next = [...variants];
        [next[index], next[target]] = [next[target]!, next[index]!];
        return reorder(next);
      });
    case 'delete':
      return withDraft(state, action.key, action.base, (variants) =>
        variants.length <= 1
          ? null
          : reorder(variants.filter((variant) => variant.id !== action.variantId)),
      );
    case 'discard':
      return without(state, action.key);
    case 'saved': {
      const rebased = rebaseOnSaved(state[action.key], action.sent, action.saved);
      return rebased ? { ...state, [action.key]: rebased } : without(state, action.key);
    }
    case 'clear':
      return Object.keys(state).length ? {} : state;
  }
}
