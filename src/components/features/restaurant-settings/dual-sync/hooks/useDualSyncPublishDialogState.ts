'use client';

import { useCallback, useState } from 'react';

import type { DualSyncPendingPublishPreview } from '../dualSyncPublishRequestDomain';
import type {
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
  DualSyncPublishResponse,
} from '@/services/ops/dual-sync';

export function useDualSyncPublishDialogState() {
  const [publishPreview, setPublishPreview] = useState<DualSyncPendingPublishPreview | null>(null);
  const [publishPreviewOpen, setPublishPreviewOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<DualSyncPublishResponse | null>(null);
  const [publishResultOpen, setPublishResultOpen] = useState(false);

  const openPublishPreview = useCallback(
    (request: DualSyncPublishRequest, plan: DualSyncPublishPreviewResponse) => {
      setPublishPreview({ request, plan });
      setPublishPreviewOpen(true);
    },
    [],
  );

  const clearPublishPreview = useCallback(() => {
    setPublishPreview(null);
    setPublishPreviewOpen(false);
  }, []);

  const openPublishResult = useCallback((result: DualSyncPublishResponse) => {
    setPublishResult(result);
    setPublishResultOpen(true);
  }, []);

  return {
    clearPublishPreview,
    openPublishPreview,
    openPublishResult,
    publishPreview,
    publishPreviewOpen,
    publishPreviewPlan: publishPreview?.plan ?? null,
    publishResult,
    publishResultOpen,
    setPublishPreviewOpen,
    setPublishResultOpen,
  };
}
