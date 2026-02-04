'use client';

import { useRealtimeConnection } from '@/hooks/ops/useRealtimeConnection';

export function ConnectionStatusBeacon() {
  const { status, metrics } = useRealtimeConnection();

  const getBeaconProps = () => {
    switch (status) {
      case 'connected':
        return {
          color: '#10b981',
          bgColor: 'bg-green-500',
          pulseSpeed: '2000ms',
          label: 'Live',
          icon: '●',
        };
      case 'connecting':
        return {
          color: '#f59e0b',
          bgColor: 'bg-amber-500',
          pulseSpeed: '500ms',
          label: 'Connecting',
          icon: '○',
        };
      case 'degraded':
        return {
          color: '#eab308',
          bgColor: 'bg-yellow-500',
          pulseSpeed: '4000ms',
          label: 'Slow',
          icon: '◎',
        };
      case 'disconnected':
      case 'error':
        return {
          color: '#ef4444',
          bgColor: 'bg-red-500',
          pulseSpeed: 'none',
          label: 'Offline',
          icon: '×',
        };
      default:
        return {
          color: '#6b7280',
          bgColor: 'bg-gray-500',
          pulseSpeed: 'none',
          label: 'Unknown',
          icon: '?',
        };
    }
  };

  const beacon = getBeaconProps();

  const formatRelativeTime = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs font-medium"
      title={`Connection status: ${beacon.label}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="relative">
        <span
          className={`ops-connection-pulse flex items-center justify-center w-2.5 h-2.5 rounded-full ${beacon.bgColor}`}
          style={{
            animation: beacon.pulseSpeed !== 'none' ? `pulse ${beacon.pulseSpeed}` : 'none',
          }}
          aria-hidden="true"
        >
          {beacon.icon}
        </span>
        <style>{`
          @keyframes pulse {
            0% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.5);
              opacity: 0.5;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .ops-connection-pulse {
              animation: none !important;
            }
          }
        `}</style>
      </div>
      <span className="text-gray-700">{beacon.label}</span>

      {status === 'connected' && metrics.lastHeartbeat && (
        <span className="text-gray-400 text-[10px]">
          {formatRelativeTime(metrics.lastHeartbeat)}
        </span>
      )}

      {status === 'degraded' && metrics.latencyMs > 500 && (
        <span className="text-amber-600 text-[10px]">{metrics.latencyMs}ms latency</span>
      )}
    </div>
  );
}
