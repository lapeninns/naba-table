'use client';

import { useMemo, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { cn } from '@/lib/utils';

import {
  appendTemplateToken,
  getEmailTemplateVariantWarnings,
  templateSupportsAskField,
  templateSupportsCueField,
  type TemplateCopyField,
} from './emailTemplatesEditorDomain';
import {
  EmailTemplatesEditorHeader,
  EmailTemplatesRotationAlert,
  EmailTemplatesViewOnlyAlert,
} from './EmailTemplatesEditorHeader';
import {
  DuplicateVariantAlert,
  EmailTemplatesGuidanceSection,
} from './EmailTemplatesGuidanceSection';
import { EmailTemplateTestActions } from './EmailTemplateTestActions';
import { EmailTemplateVariantsSection } from './EmailTemplateVariantsSection';

import type { EmailTemplatesActivePane } from '@/hooks/ops/useOpsEmailTemplatesPageState';
import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';
import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

type EmailTemplatesEditorPaneProps = {
  restaurantName: string;
  canEdit: boolean;
  baseTemplate: RestaurantEmailTemplate | null;
  currentVariants: RestaurantEmailTemplateVariant[];
  currentVariant: RestaurantEmailTemplateVariant | null;
  selectedVariantId: string | null;
  activeVariantCount: number;
  isCurrentDirty: boolean;
  testEmail: string;
  onTestEmailChange: (value: string) => void;
  activePane: EmailTemplatesActivePane;
  isSaving: boolean;
  isResetting: boolean;
  isSendingTest: boolean;
  onBackToList: () => void;
  onOpenPreview: () => void;
  onDiscardCurrent: () => void;
  onSave: () => void;
  onAddVariant: () => void;
  onMoveVariant: (variantId: string, direction: -1 | 1) => void;
  onDeleteVariant: (variantId: string) => void;
  onSelectVariant: (variantId: string) => void;
  onResetTemplate: (templateKey: RestaurantBookingEmailTemplateKey) => void;
  onSendTest: () => void;
  onUpdateVariant: (
    variantId: string,
    updater: (variant: RestaurantEmailTemplateVariant) => RestaurantEmailTemplateVariant,
  ) => void;
};

export function EmailTemplatesEditorPane({
  restaurantName,
  canEdit,
  baseTemplate,
  currentVariants,
  currentVariant,
  selectedVariantId,
  activeVariantCount,
  isCurrentDirty,
  testEmail,
  onTestEmailChange,
  activePane,
  isSaving,
  isResetting,
  isSendingTest,
  onBackToList,
  onOpenPreview,
  onDiscardCurrent,
  onSave,
  onAddVariant,
  onMoveVariant,
  onDeleteVariant,
  onSelectVariant,
  onResetTemplate,
  onSendTest,
  onUpdateVariant,
}: EmailTemplatesEditorPaneProps) {
  const [tokenTarget, setTokenTarget] = useState<TemplateCopyField>('intro');

  const variantWarnings = useMemo(
    () => getEmailTemplateVariantWarnings({ currentVariant, currentVariants }),
    [currentVariant, currentVariants],
  );

  const insertVariable = (token: string) => {
    if (!currentVariant) {
      return;
    }

    onUpdateVariant(currentVariant.id, (variant) => ({
      ...variant,
      [tokenTarget]: appendTemplateToken(variant[tokenTarget], token),
    }));
  };

  const showCueField = templateSupportsCueField(baseTemplate?.key);
  const showAskField = templateSupportsAskField(baseTemplate?.key);

  return (
    <main className="min-w-0">
      <EmailTemplatesEditorHeader
        baseTemplate={baseTemplate}
        canEdit={canEdit}
        isCurrentDirty={isCurrentDirty}
        isSaving={isSaving}
        onBackToList={onBackToList}
        onDiscardCurrent={onDiscardCurrent}
        onOpenPreview={onOpenPreview}
        onSave={onSave}
        restaurantName={restaurantName}
      />

      <div>
        <div className="flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-8">
          <EmailTemplatesViewOnlyAlert canEdit={canEdit} restaurantName={restaurantName} />
          <EmailTemplatesRotationAlert
            activeVariantCount={activeVariantCount}
            hasTemplate={Boolean(baseTemplate)}
          />

          {baseTemplate && currentVariant ? (
            <>
              <EmailTemplatesGuidanceSection
                baseTemplate={baseTemplate}
                canEdit={canEdit}
                onInsertVariable={insertVariable}
                tokenTarget={tokenTarget}
              />
              <DuplicateVariantAlert
                duplicateActiveVariantName={variantWarnings.duplicateActiveVariantName}
              />
              <EmailTemplateVariantsSection
                baseTemplate={baseTemplate}
                canEdit={canEdit}
                currentVariant={currentVariant}
                currentVariants={currentVariants}
                onAddVariant={onAddVariant}
                onMoveVariant={onMoveVariant}
                onSelectVariant={onSelectVariant}
                onSetTokenTarget={setTokenTarget}
                onUpdateVariant={onUpdateVariant}
                selectedVariantId={selectedVariantId}
                showAskField={showAskField}
                showCueField={showCueField}
                variantWarnings={variantWarnings}
              />
              <EmailTemplateTestActions
                baseTemplate={baseTemplate}
                canEdit={canEdit}
                currentVariant={currentVariant}
                currentVariants={currentVariants}
                isResetting={isResetting}
                isSendingTest={isSendingTest}
                onDeleteVariant={onDeleteVariant}
                onResetTemplate={onResetTemplate}
                onSendTest={onSendTest}
                onTestEmailChange={onTestEmailChange}
                testEmail={testEmail}
              />
            </>
          ) : (
            <OpsEmptyState
              title="Choose a template"
              description="Choose a template from the left to start editing."
              className={cn(
                'min-h-[320px] rounded-[1.5rem] bg-muted/40 px-6',
                activePane === 'editor' && 'animate-in fade-in slide-in-from-right-2 duration-200',
              )}
            />
          )}
        </div>
      </div>
    </main>
  );
}
