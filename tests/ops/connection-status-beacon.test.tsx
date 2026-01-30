import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionStatusBeacon } from '@/components/features/dashboard/ConnectionStatusBeacon';

import type {
  ConnectionStatus,
  RealtimeConnectionMetrics,
} from '@/hooks/ops/useRealtimeConnection';

interface MockReturnValue {
  status: ConnectionStatus;
  metrics: RealtimeConnectionMetrics;
}

const mockUseRealtimeConnection = vi.fn<() => MockReturnValue>();

vi.mock('@/hooks/ops/useRealtimeConnection', () => ({
  useRealtimeConnection: () => mockUseRealtimeConnection(),
}));

function createMockMetrics(
  overrides: Partial<RealtimeConnectionMetrics> = {},
): RealtimeConnectionMetrics {
  return {
    messagesReceived: 0,
    messagesPerSecond: 0,
    reconnectAttempts: 0,
    lastHeartbeat: null,
    lastError: null,
    uptimeSeconds: 0,
    latencyMs: 0,
    ...overrides,
  };
}

describe('ConnectionStatusBeacon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('status rendering', () => {
    it('renders connected state with Live label', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByTitle('Connection status: Live')).toBeInTheDocument();
    });

    it('renders connecting state with Connecting label', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connecting',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('Connecting')).toBeInTheDocument();
      expect(screen.getByTitle('Connection status: Connecting')).toBeInTheDocument();
    });

    it('renders degraded state with Slow label', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'degraded',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('Slow')).toBeInTheDocument();
      expect(screen.getByTitle('Connection status: Slow')).toBeInTheDocument();
    });

    it('renders disconnected state with Offline label', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'disconnected',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByTitle('Connection status: Offline')).toBeInTheDocument();
    });

    it('renders error state with Offline label', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'error',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByTitle('Connection status: Offline')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible aria-label on beacon indicator', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByLabelText('Live')).toBeInTheDocument();
    });

    it('has title attribute for tooltip on container', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'degraded',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const container = screen.getByTitle('Connection status: Slow');
      expect(container).toBeInTheDocument();
    });
  });

  describe('heartbeat display', () => {
    it('shows relative time when connected with lastHeartbeat', () => {
      const thirtySecondsAgo = new Date('2026-01-19T11:59:30Z');
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics({ lastHeartbeat: thirtySecondsAgo }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('30s ago')).toBeInTheDocument();
    });

    it('shows minutes when heartbeat is older', () => {
      const fiveMinutesAgo = new Date('2026-01-19T11:55:00Z');
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics({ lastHeartbeat: fiveMinutesAgo }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });

    it('shows hours when heartbeat is much older', () => {
      const twoHoursAgo = new Date('2026-01-19T10:00:00Z');
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics({ lastHeartbeat: twoHoursAgo }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('does not show heartbeat time when not connected', () => {
      const recentHeartbeat = new Date('2026-01-19T11:59:50Z');
      mockUseRealtimeConnection.mockReturnValue({
        status: 'disconnected',
        metrics: createMockMetrics({ lastHeartbeat: recentHeartbeat }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('does not show heartbeat time when lastHeartbeat is null', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics({ lastHeartbeat: null }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });
  });

  describe('latency display', () => {
    it('shows latency when degraded and latency exceeds 500ms', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'degraded',
        metrics: createMockMetrics({ latencyMs: 750 }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.getByText('750ms latency')).toBeInTheDocument();
    });

    it('does not show latency when degraded but latency is under 500ms', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'degraded',
        metrics: createMockMetrics({ latencyMs: 300 }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.queryByText(/latency/)).not.toBeInTheDocument();
    });

    it('does not show latency when connected even with high latency', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics({ latencyMs: 1000 }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.queryByText(/latency/)).not.toBeInTheDocument();
    });

    it('does not show latency when latency is exactly 500ms', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'degraded',
        metrics: createMockMetrics({ latencyMs: 500 }),
      });

      render(<ConnectionStatusBeacon />);

      expect(screen.queryByText(/latency/)).not.toBeInTheDocument();
    });
  });

  describe('visual styling', () => {
    it('applies green color for connected status', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const beacon = screen.getByLabelText('Live');
      expect(beacon).toHaveClass('bg-green-500');
    });

    it('applies amber color for connecting status', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connecting',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const beacon = screen.getByLabelText('Connecting');
      expect(beacon).toHaveClass('bg-amber-500');
    });

    it('applies yellow color for degraded status', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'degraded',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const beacon = screen.getByLabelText('Slow');
      expect(beacon).toHaveClass('bg-yellow-500');
    });

    it('applies red color for error status', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'error',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const beacon = screen.getByLabelText('Offline');
      expect(beacon).toHaveClass('bg-red-500');
    });
  });

  describe('animation', () => {
    it('has pulse animation for connected status', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connected',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const beacon = screen.getByLabelText('Live');
      expect(beacon).toHaveStyle({ animation: 'pulse 2000ms' });
    });

    it('has faster pulse animation for connecting status', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'connecting',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const beacon = screen.getByLabelText('Connecting');
      expect(beacon).toHaveStyle({ animation: 'pulse 500ms' });
    });

    it('has no animation for error status', () => {
      mockUseRealtimeConnection.mockReturnValue({
        status: 'error',
        metrics: createMockMetrics(),
      });

      render(<ConnectionStatusBeacon />);

      const beacon = screen.getByLabelText('Offline');
      expect(beacon).toHaveStyle({ animation: 'none' });
    });
  });
});
