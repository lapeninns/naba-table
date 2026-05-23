import { RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';
import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

export function EmailTemplateTestActions({
  baseTemplate,
  canEdit,
  currentVariant,
  currentVariants,
  isResetting,
  isSendingTest,
  onDeleteVariant,
  onResetTemplate,
  onSendTest,
  onTestEmailChange,
  testEmail,
}: {
  readonly baseTemplate: RestaurantEmailTemplate;
  readonly canEdit: boolean;
  readonly currentVariant: RestaurantEmailTemplateVariant;
  readonly currentVariants: ReadonlyArray<RestaurantEmailTemplateVariant>;
  readonly isResetting: boolean;
  readonly isSendingTest: boolean;
  readonly onDeleteVariant: (variantId: string) => void;
  readonly onResetTemplate: (templateKey: RestaurantEmailTemplate['key']) => void;
  readonly onSendTest: () => void;
  readonly onTestEmailChange: (value: string) => void;
  readonly testEmail: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-background px-4 py-5 shadow-sm md:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Label htmlFor="email-template-test-address">Send a test email</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="email-template-test-address"
              type="email"
              value={testEmail}
              onChange={(event) => onTestEmailChange(event.target.value)}
              placeholder="Send a test email to..."
              disabled={!canEdit}
              className="h-11 min-w-[260px] rounded-xl border-border"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onSendTest}
              disabled={!canEdit || isSendingTest}
            >
              {isSendingTest ? (
                <RotateCcw data-icon="inline-start" className="animate-spin" />
              ) : null}
              <span>{isSendingTest ? 'Sending...' : 'Send test'}</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            System shell, booking facts, and destination URLs stay locked. Delivery copy, subject,
            and preheader change here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onResetTemplate(baseTemplate.key)}
            disabled={!canEdit || baseTemplate.status === 'default' || isResetting}
          >
            {isResetting ? <RotateCcw data-icon="inline-start" className="animate-spin" /> : null}
            <span>Reset template</span>
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onDeleteVariant(currentVariant.id)}
            disabled={!canEdit || currentVariants.length <= 1}
          >
            <Trash2 data-icon="inline-start" />
            <span>Delete variant</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
