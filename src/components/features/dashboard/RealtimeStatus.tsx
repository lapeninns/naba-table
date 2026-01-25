'use client';

import { useRealtimeDiagnostics } from '@/hooks/ops/useRealtimeDiagnostics';

export function RealtimeStatus() {
  const status = useRealtimeDiagnostics();

  if (!status.enabled) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-500 text-white">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/50" />
            Polling Mode
          </div>
          <div className="text-xs mt-1 opacity-75">
            Set NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN=false to disable realtime
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
          status.connected ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status.connected ? 'bg-white animate-pulse' : 'bg-white/50'
            }`}
          />
          {status.connected ? 'Live Updates' : 'Connecting...'}
          {status.channels > 0 && ` • ${status.channels} channels`}
        </div>
        {status.error && (
          <div className="text-xs mt-1 opacity-75 max-w-xs truncate">{status.error}</div>
        )}
        {status.lastEvent && (
          <div className="text-xs mt-1 opacity-75">
            Last update: {status.lastEvent.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
