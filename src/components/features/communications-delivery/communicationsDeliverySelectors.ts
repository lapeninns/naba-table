import type { CommunicationsDeliveryOverviewMetric } from './communicationsDeliveryTypes';
import type { OpsEmailDeliverySummary } from '@/types/emailDelivery';
import type { OpsSmsDeliverySummary } from '@/types/smsDelivery';


function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

export function buildCommunicationsOverviewMetrics(params: {
  emailSummary: OpsEmailDeliverySummary | null;
  messageSummary: OpsSmsDeliverySummary | null;
}): CommunicationsDeliveryOverviewMetric[] {
  const { emailSummary, messageSummary } = params;

  return [
    {
      label: 'Email delivered',
      value: emailSummary ? formatPercent(emailSummary.deliveredRate) : '0%',
      hint: emailSummary ? `${emailSummary.delivered}/${emailSummary.total} attempts` : null,
    },
    {
      label: 'Email failed',
      value: emailSummary
        ? String(emailSummary.bounced + emailSummary.complained + emailSummary.failed)
        : '0',
      hint: emailSummary ? `${emailSummary.stuckInFlight ?? 0} stuck in flight` : null,
    },
    {
      label: 'Messages delivered',
      value: messageSummary ? formatPercent(messageSummary.deliveredRate) : '0%',
      hint: messageSummary ? `${messageSummary.delivered}/${messageSummary.total} attempts` : null,
    },
    {
      label: 'WhatsApp / SMS',
      value: messageSummary
        ? `${messageSummary.whatsappCount ?? 0} / ${messageSummary.smsCount ?? 0}`
        : '0 / 0',
      hint:
        messageSummary && typeof messageSummary.fallbackCount === 'number'
          ? `${messageSummary.fallbackCount} fallbacks`
          : null,
    },
  ];
}
