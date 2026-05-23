import { EmailTemplateVariantCopyFields } from './EmailTemplateVariantCopyFields';
import { EmailTemplateVariantTabs } from './EmailTemplateVariantTabs';

import type { EmailTemplateVariantWarnings, TemplateCopyField } from './emailTemplatesEditorDomain';
import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';
import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

type UpdateVariant = (
  variantId: string,
  updater: (variant: RestaurantEmailTemplateVariant) => RestaurantEmailTemplateVariant,
) => void;

export function EmailTemplateVariantsSection({
  baseTemplate,
  canEdit,
  currentVariant,
  currentVariants,
  onAddVariant,
  onMoveVariant,
  onSelectVariant,
  onSetTokenTarget,
  onUpdateVariant,
  selectedVariantId,
  showAskField,
  showCueField,
  variantWarnings,
}: {
  readonly baseTemplate: RestaurantEmailTemplate;
  readonly canEdit: boolean;
  readonly currentVariant: RestaurantEmailTemplateVariant;
  readonly currentVariants: ReadonlyArray<RestaurantEmailTemplateVariant>;
  readonly onAddVariant: () => void;
  readonly onMoveVariant: (variantId: string, direction: -1 | 1) => void;
  readonly onSelectVariant: (variantId: string) => void;
  readonly onSetTokenTarget: (field: TemplateCopyField) => void;
  readonly onUpdateVariant: UpdateVariant;
  readonly selectedVariantId: string | null;
  readonly showAskField: boolean;
  readonly showCueField: boolean;
  readonly variantWarnings: EmailTemplateVariantWarnings;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-background shadow-sm">
      <EmailTemplateVariantTabs
        canEdit={canEdit}
        currentVariant={currentVariant}
        currentVariants={currentVariants}
        onAddVariant={onAddVariant}
        onMoveVariant={onMoveVariant}
        onSelectVariant={onSelectVariant}
        selectedVariantId={selectedVariantId}
      />
      <EmailTemplateVariantCopyFields
        baseTemplate={baseTemplate}
        canEdit={canEdit}
        currentVariant={currentVariant}
        onSetTokenTarget={onSetTokenTarget}
        onUpdateVariant={onUpdateVariant}
        showAskField={showAskField}
        showCueField={showCueField}
        variantWarnings={variantWarnings}
      />
    </section>
  );
}
