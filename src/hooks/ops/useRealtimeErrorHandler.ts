'use client';

import { useCallback } from 'react';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RealtimeError {
  code: string;
  message: string;
  timestamp: Date;
  severity: ErrorSeverity;
  context?: Record<string, unknown>;
}

export function useRealtimeErrorHandler() {
  const handleError = useCallback((error: RealtimeError) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Realtime Error]', error);
    }

    if (error.severity === 'critical') {
      triggerCriticalAlert(error);
    } else if (error.severity === 'high') {
      sendAnalyticsAlert(error);
    } else if (error.severity === 'medium') {
      logToAnalytics(error);
    }
  }, []);

  const createError = useCallback(
    (
      code: string,
      message: string,
      severity: ErrorSeverity = 'medium',
      context?: Record<string, unknown>,
    ): RealtimeError => {
      return {
        code,
        message,
        timestamp: new Date(),
        severity,
        context,
      };
    },
    [],
  );

  return {
    handleError,
    createError,
  };
}

function triggerCriticalAlert(error: RealtimeError) {
  console.error(
    `%c🚨 CRITICAL REALTIME ERROR%c ${error.code}: ${error.message}`,
    'background: #fee2e2; color: #000; padding: 4px; font-weight: bold;',
    'color: #dc2626; padding: 4px;',
    error,
  );
}

function sendAnalyticsAlert(error: RealtimeError) {
  console.warn(`⚠️ Realtime error [${error.code}]:`, error);
}

function logToAnalytics(error: RealtimeError) {
  console.info(`ℹ️ Realtime issue [${error.code}]:`, error.message);
}
