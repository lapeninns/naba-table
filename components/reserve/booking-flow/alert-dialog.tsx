"use client";

import React, { useEffect, useRef } from "react";

import { Button } from "@/components/reserve/ui-primitives";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onConfirm: () => void;
  title: string;
  description: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({ open, onOpenChange, onConfirm, title, description }) => {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="relative m-4 w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="alert-dialog-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100"
            onClick={() => onOpenChange(false)}
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>
        <div id="alert-dialog-description" className="px-6 py-4 text-sm text-slate-700">
          {description}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Never mind
          </Button>
          <Button ref={confirmRef} variant="destructive" onClick={onConfirm}>
            Yes, cancel it
          </Button>
        </div>
      </div>
    </div>
  );
};
