'use client';

import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

import type { AssignmentValidation } from '../../types';

export type TableAssignmentAlertsProps = {
  applyError: string | null;
  smartAssignError: string | null;
  validation: Pick<AssignmentValidation, 'errors' | 'warnings'>;
  successMessage: string | null;
};

export function TableAssignmentAlerts({
  applyError,
  smartAssignError,
  validation,
  successMessage,
}: TableAssignmentAlertsProps) {
  const hasAlerts =
    applyError ||
    smartAssignError ||
    successMessage ||
    validation.errors.length > 0 ||
    validation.warnings.length > 0;
  if (!hasAlerts) return null;

  return (
    <div className="grid gap-2">
      {successMessage && (
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm">
          <CheckCircle2 className="size-3" />
          {successMessage}
        </div>
      )}

      {(applyError || smartAssignError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-[10px] font-bold uppercase tracking-wider text-destructive shadow-sm">
          <AlertCircle className="size-3" />
          <span className="truncate">{applyError || smartAssignError}</span>
        </div>
      )}

      {validation.errors.map((errorText, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-[10px] font-bold uppercase tracking-wider text-destructive shadow-sm"
        >
          <AlertCircle className="size-3" />
          <span className="truncate">{errorText}</span>
        </div>
      ))}

      {validation.warnings.map((warning, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm"
        >
          <AlertTriangle className="size-3" />
          <span className="truncate">{warning}</span>
        </div>
      ))}
    </div>
  );
}

export default TableAssignmentAlerts;
