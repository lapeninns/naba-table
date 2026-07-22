import { Info } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import {
  buildEmailTemplateCopyFieldSections,
  buildTemplateCopyCounterState,
  formatUnknownTemplateTokens,
  getTemplateCopyFieldId,
  type EmailTemplateVariantWarnings,
  type TemplateCopyField,
  type TemplateCopyFieldSpec,
} from './emailTemplatesEditorDomain';

import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';
import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

type UpdateVariant = (
  variantId: string,
  updater: (variant: RestaurantEmailTemplateVariant) => RestaurantEmailTemplateVariant,
) => void;

type EmailTemplateVariantCopyFieldsProps = {
  readonly baseTemplate: RestaurantEmailTemplate;
  readonly canEdit: boolean;
  readonly currentVariant: RestaurantEmailTemplateVariant;
  readonly onSetTokenTarget: (field: TemplateCopyField) => void;
  readonly onUpdateVariant: UpdateVariant;
  readonly showAskField: boolean;
  readonly showCueField: boolean;
  readonly variantWarnings: EmailTemplateVariantWarnings;
};

export function EmailTemplateVariantCopyFields({
  baseTemplate,
  canEdit,
  currentVariant,
  onSetTokenTarget,
  onUpdateVariant,
  showAskField,
  showCueField,
  variantWarnings,
}: EmailTemplateVariantCopyFieldsProps) {
  const fieldSections = buildEmailTemplateCopyFieldSections({
    showAskField,
    showCueField,
    supportsCtaLabel: baseTemplate.supportsCtaLabel,
  });

  return (
    <div className="grid gap-6 px-4 py-5 md:px-5 md:py-6">
      <VariantNameAndStatus
        canEdit={canEdit}
        currentVariant={currentVariant}
        onUpdateVariant={onUpdateVariant}
      />
      {fieldSections.map((section) => (
        <div
          key={section.fields.map((fieldSpec) => fieldSpec.field).join('-')}
          className={section.layout === 'two-column' ? 'grid gap-5 lg:grid-cols-2' : undefined}
        >
          {section.fields.map((fieldSpec) => (
            <CopyField
              key={fieldSpec.field}
              currentVariant={currentVariant}
              disabled={!canEdit}
              fieldSpec={fieldSpec}
              onSetTokenTarget={onSetTokenTarget}
              onUpdateVariant={onUpdateVariant}
              warnings={variantWarnings.unknownTokensByField[fieldSpec.field]}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function VariantNameAndStatus({
  canEdit,
  currentVariant,
  onUpdateVariant,
}: {
  readonly canEdit: boolean;
  readonly currentVariant: RestaurantEmailTemplateVariant;
  readonly onUpdateVariant: UpdateVariant;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),220px]">
      <div className="space-y-2">
        <Label htmlFor="email-template-variant-name">Internal name</Label>
        <Input
          id="email-template-variant-name"
          value={currentVariant.name}
          onChange={(event) =>
            onUpdateVariant(currentVariant.id, (variant) => ({
              ...variant,
              name: event.target.value,
            }))
          }
          disabled={!canEdit}
          className="h-11 rounded-xl border-border"
        />
      </div>

      <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">Status</div>
            <Text variant="caption">
              {currentVariant.isActive ? 'Active in rotation' : 'Paused for sends'}
            </Text>
          </div>
          <Switch
            id={`variant-active-${currentVariant.id}`}
            checked={currentVariant.isActive}
            aria-label={`Toggle ${currentVariant.name} active status`}
            onCheckedChange={(checked) =>
              onUpdateVariant(currentVariant.id, (variant) => ({
                ...variant,
                isActive: checked,
              }))
            }
            disabled={!canEdit}
          />
        </div>
      </div>
    </div>
  );
}

function CopyField({
  currentVariant,
  disabled,
  fieldSpec,
  onSetTokenTarget,
  onUpdateVariant,
  warnings,
}: {
  readonly currentVariant: RestaurantEmailTemplateVariant;
  readonly disabled: boolean;
  readonly fieldSpec: TemplateCopyFieldSpec;
  readonly onSetTokenTarget: (field: TemplateCopyField) => void;
  readonly onUpdateVariant: UpdateVariant;
  readonly warnings: ReadonlyArray<string>;
}) {
  const { field } = fieldSpec;
  const id = getTemplateCopyFieldId(field);
  const value = currentVariant[field];

  if (fieldSpec.control === 'textarea') {
    return (
      <CopyTextareaField
        currentVariant={currentVariant}
        disabled={disabled}
        field={field}
        helpText={fieldSpec.helpText}
        id={id}
        label={fieldSpec.label}
        onSetTokenTarget={onSetTokenTarget}
        onUpdateVariant={onUpdateVariant}
        showTargetHint={fieldSpec.showTargetHint}
        textareaClassName={fieldSpec.className}
        value={value}
        warnings={warnings}
      />
    );
  }

  return (
    <div className="space-y-2">
      <FieldLabelWithCounter field={field} htmlFor={id} label={fieldSpec.label} value={value} />
      <Input
        id={id}
        value={value}
        onFocus={() => onSetTokenTarget(field)}
        onChange={(event) =>
          onUpdateVariant(currentVariant.id, (variant) => ({
            ...variant,
            [field]: event.target.value,
          }))
        }
        disabled={disabled}
        className={fieldSpec.className}
      />
      <FieldHelp helpText={fieldSpec.helpText} warnings={warnings} />
    </div>
  );
}

function CopyTextareaField({
  currentVariant,
  disabled,
  field,
  helpText,
  id,
  label,
  onSetTokenTarget,
  onUpdateVariant,
  showTargetHint = false,
  textareaClassName,
  value,
  warnings,
}: {
  readonly currentVariant: RestaurantEmailTemplateVariant;
  readonly disabled: boolean;
  readonly field: TemplateCopyField;
  readonly helpText?: string;
  readonly id: string;
  readonly label: string;
  readonly onSetTokenTarget: (field: TemplateCopyField) => void;
  readonly onUpdateVariant: UpdateVariant;
  readonly showTargetHint?: boolean;
  readonly textareaClassName: string;
  readonly value: string;
  readonly warnings: ReadonlyArray<string>;
}) {
  return (
    <div className={field === 'intro' ? 'space-y-3' : 'space-y-2'}>
      <FieldLabelWithCounter
        field={field}
        htmlFor={id}
        label={label}
        showTargetHint={showTargetHint}
        value={value}
      />
      <Textarea
        id={id}
        value={value}
        onFocus={() => onSetTokenTarget(field)}
        onChange={(event) =>
          onUpdateVariant(currentVariant.id, (variant) => ({
            ...variant,
            [field]: event.target.value,
          }))
        }
        disabled={disabled}
        className={textareaClassName}
      />
      <FieldHelp helpText={helpText} warnings={warnings} />
    </div>
  );
}

function FieldLabelWithCounter({
  field,
  htmlFor,
  label,
  showTargetHint = false,
  value,
}: {
  readonly field: TemplateCopyField;
  readonly htmlFor: string;
  readonly label: string;
  readonly showTargetHint?: boolean;
  readonly value: string;
}) {
  const counter = buildTemplateCopyCounterState({ field, value });

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="flex items-center gap-3">
        <span className={cn('text-xs', counter.toneClassName)}>{counter.label}</span>
        {showTargetHint ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="size-3.5" />
            Click a field to change token target
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldHelp({
  helpText,
  warnings,
}: {
  readonly helpText?: string;
  readonly warnings: ReadonlyArray<string>;
}) {
  const warningText = formatUnknownTemplateTokens(warnings);

  if (warningText)
    return (
      <Text variant="caption" className="text-destructive">
        {warningText}
      </Text>
    );

  return helpText ? <Text variant="caption">{helpText}</Text> : null;
}
