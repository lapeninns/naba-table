import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import type { GbpTerminalNoticesResponseV1 } from '@/services/ops/dual-sync';

export function GbpTerminalNotices({ data }: { data: GbpTerminalNoticesResponseV1 }) {
  if (data.notices.length === 0) {
    return <p className="text-sm text-muted-foreground">No terminal Google write notices.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.notices.map((notice) => (
        <Alert
          key={notice.id}
          variant={notice.terminal_kind === 'consumed' ? 'success' : 'warning'}
        >
          <AlertTitle>Google write {notice.terminal_kind.replaceAll('_', ' ')}</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span>
              <Badge variant="outline" className="font-mono">
                {notice.safe_reason_code}
              </Badge>
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
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
