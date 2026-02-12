'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  return (
    <>
      {successMessage ? (
        <Alert variant="success" role="status" aria-live="polite">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {applyError ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{applyError}</AlertDescription>
        </Alert>
      ) : null}

      {smartAssignError ? (
        <Alert>
          <AlertTitle>Smart assign unavailable</AlertTitle>
          <AlertDescription>{smartAssignError}</AlertDescription>
        </Alert>
      ) : null}

      {validation.errors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Table assignment blocked</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {validation.errors.map((errorText) => (
                <li key={errorText}>{errorText}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {validation.warnings.length > 0 ? (
        <Alert>
          <AlertTitle>Review before assigning</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {validation.warnings.map((warning) => (
                <li key={warning}>
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                    {warning}
                  </span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

export default TableAssignmentAlerts;

