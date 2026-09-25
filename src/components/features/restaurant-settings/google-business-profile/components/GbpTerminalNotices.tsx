import { GbpPublishOutcomeBadge } from '../../dual-sync/GbpPublishOutcomeBadge';

import type { GbpTerminalNoticesResponseV1 } from '@/services/ops/dual-sync';

export function GbpTerminalNotices({ data }: { data: GbpTerminalNoticesResponseV1 }) {
  if (data.notices.length === 0) {
    return <p className="text-sm text-muted-foreground">No provider outcomes to show.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border/60">
      {data.notices.map((notice) => (
        <li key={notice.id} className="flex flex-col gap-1 py-2 text-sm first:pt-0 last:pb-0">
          <span className="flex flex-wrap items-center gap-2">
            <GbpPublishOutcomeBadge status={notice.terminal_kind} />
            <span className="font-mono text-xs">{notice.safe_reason_code}</span>
          </span>
          {notice.providerInstruction === 'refresh_then_create_new_preview' ? (
            <span>Provider outcome is unknown. Refresh Google, then create a new preview.</span>
          ) : null}
          {notice.operationalDeliveryInstruction ===
          'in_app_notice_available_verify_operational_channel' ? (
            <span>
              Operational delivery is unknown. Verify the operational notification channel.
            </span>
          ) : null}
          <span className="font-mono text-xs text-muted-foreground">
            Grant {notice.grant_id} · status {notice.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
