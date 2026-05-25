'use client';

import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import type { DualSyncPublishJobStatus } from './dualSyncPublishJobRowDomain';

export interface DualSyncPublishJobStatusBadgeProps {
  readonly status: DualSyncPublishJobStatus;
}

export function DualSyncPublishJobStatusBadge({ status }: DualSyncPublishJobStatusBadgeProps) {
  switch (status) {
    case 'success':
      return (
        <Badge
          variant="status-confirmed"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <CheckCircle2 className="size-3" /> Success
        </Badge>
      );
    case 'partial':
      return (
        <Badge
          variant="status-pending"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <AlertCircle className="size-3" /> Partial
        </Badge>
      );
    case 'failed':
      return (
        <Badge
          variant="status-cancelled"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <XCircle className="size-3" /> Failed
        </Badge>
      );
    case 'in-flight':
    default:
      return (
        <Badge
          variant="status-pending"
          className="inline-flex items-center gap-1 font-mono text-[10px]"
        >
          <Clock className="size-3" /> In flight
        </Badge>
      );
  }
}
