"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { BOOKING_STATUS_CONFIG } from "./BookingStatusBadge";

import type { ConflictPayload } from "./BookingErrorBoundary";
import type { OpsBookingStatus } from "@/types/ops";

type ConflictResolverProps = {
  conflict: ConflictPayload;
  onClose: () => void;
};

function formatStatus(status: OpsBookingStatus | null | undefined): string {
  if (!status) return "Unknown";
  const config = BOOKING_STATUS_CONFIG[status];
  if (config) {
    return config.label;
  }
  return status.replaceAll("_", " ");
}

export function ConflictResolver({ conflict, onClose }: ConflictResolverProps) {
  const attemptedLabel = useMemo(() => formatStatus(conflict.attemptedStatus ?? null), [conflict.attemptedStatus]);
  const currentLabel = useMemo(() => formatStatus(conflict.currentStatus ?? null), [conflict.currentStatus]);

  const handleReload = async () => {
    if (conflict.onReload) {
      await conflict.onReload();
    }
    onClose();
  };

  const description =
    conflict.message ?? "Another teammate updated this booking before your change was saved.";

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            Booking conflict detected
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Attempted status</span>
            <Badge variant="outline" className="w-fit">
              {attemptedLabel}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Current status</span>
            <Badge variant="outline" className="w-fit">
              {currentLabel}
            </Badge>
          </div>
          {conflict.updatedAt ? (
            <p className="text-xs text-muted-foreground">
              Last updated at <span className="font-medium">{new Date(conflict.updatedAt).toLocaleString()}</span>
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Dismiss
          </Button>
          <Button type="button" onClick={handleReload}>
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
            Reload booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
