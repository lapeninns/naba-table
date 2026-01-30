/**
 * Application Metrics Collection
 *
 * Provides a simple metrics API for tracking application performance
 * and business metrics. Outputs structured JSON for log aggregation.
 *
 * In production, these metrics can be:
 * - Scraped from logs by Datadog/CloudWatch
 * - Sent to a metrics backend via the emit function
 * - Aggregated in Vercel Analytics
 */

import { logger } from '@/lib/logger';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timing';

export interface MetricOptions {
  tags?: Record<string, string>;
  timestamp?: Date;
}

interface MetricPayload {
  name: string;
  type: MetricType;
  value: number;
  tags: Record<string, string>;
  timestamp: string;
}

const metricsLogger = logger.child({ module: 'metrics' });

/**
 * Emit a metric to the logging system
 */
function emitMetric(payload: MetricPayload): void {
  // Log as structured JSON for log aggregation tools
  metricsLogger.info(`metric:${payload.name}`, {
    metric: payload,
  });

  // In production, could also send to a metrics backend:
  // await fetch(METRICS_ENDPOINT, { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Increment a counter metric
 */
export function incrementCounter(
  name: string,
  value: number = 1,
  options: MetricOptions = {}
): void {
  emitMetric({
    name,
    type: 'counter',
    value,
    tags: options.tags || {},
    timestamp: (options.timestamp || new Date()).toISOString(),
  });
}

/**
 * Set a gauge metric (point-in-time value)
 */
export function setGauge(
  name: string,
  value: number,
  options: MetricOptions = {}
): void {
  emitMetric({
    name,
    type: 'gauge',
    value,
    tags: options.tags || {},
    timestamp: (options.timestamp || new Date()).toISOString(),
  });
}

/**
 * Record a histogram value (for distribution analysis)
 */
export function recordHistogram(
  name: string,
  value: number,
  options: MetricOptions = {}
): void {
  emitMetric({
    name,
    type: 'histogram',
    value,
    tags: options.tags || {},
    timestamp: (options.timestamp || new Date()).toISOString(),
  });
}

/**
 * Record a timing metric (in milliseconds)
 */
export function recordTiming(
  name: string,
  durationMs: number,
  options: MetricOptions = {}
): void {
  emitMetric({
    name,
    type: 'timing',
    value: durationMs,
    tags: options.tags || {},
    timestamp: (options.timestamp || new Date()).toISOString(),
  });
}

/**
 * Time an async operation and record the duration
 */
export async function timeAsync<T>(
  name: string,
  fn: () => Promise<T>,
  options: MetricOptions = {}
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    recordTiming(name, duration, {
      ...options,
      tags: { ...options.tags, status: 'success' },
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordTiming(name, duration, {
      ...options,
      tags: { ...options.tags, status: 'error' },
    });
    throw error;
  }
}

/**
 * Time a sync operation and record the duration
 */
export function timeSync<T>(
  name: string,
  fn: () => T,
  options: MetricOptions = {}
): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    recordTiming(name, duration, {
      ...options,
      tags: { ...options.tags, status: 'success' },
    });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordTiming(name, duration, {
      ...options,
      tags: { ...options.tags, status: 'error' },
    });
    throw error;
  }
}

// Pre-defined metric names for consistency
export const Metrics = {
  // API metrics
  API_REQUEST_DURATION: 'api.request.duration',
  API_REQUEST_COUNT: 'api.request.count',
  API_ERROR_COUNT: 'api.error.count',

  // Booking metrics
  BOOKING_CREATED: 'booking.created',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_ASSIGNMENT_DURATION: 'booking.assignment.duration',

  // Capacity metrics
  CAPACITY_CHECK_DURATION: 'capacity.check.duration',
  SOFT_HOLD_CREATED: 'capacity.soft_hold.created',
  SOFT_HOLD_EXPIRED: 'capacity.soft_hold.expired',

  // Database metrics
  DB_QUERY_DURATION: 'db.query.duration',
  DB_CONNECTION_COUNT: 'db.connection.count',

  // Email metrics
  EMAIL_QUEUED: 'email.queued',
  EMAIL_SENT: 'email.sent',
  EMAIL_FAILED: 'email.failed',
} as const;
