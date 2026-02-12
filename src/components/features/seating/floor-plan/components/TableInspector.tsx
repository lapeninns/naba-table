import { Clock, MapPin, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { getStatusColor } from '../lib/status';

import type { FloorPlanTableInspector } from '../lib/types';

export function TableInspector({
  table,
  onClose,
  onAddBooking,
  onBrowseBookings,
  isOnline,
  isLaunchingBooking,
  variant = 'floating',
}: {
  table: FloorPlanTableInspector | null;
  onClose: () => void;
  onAddBooking: () => void;
  onBrowseBookings: () => void;
  isOnline: boolean;
  isLaunchingBooking: boolean;
  variant?: 'floating' | 'sheet' | 'panel';
}) {
  if (!table) return null;
  const theme = getStatusColor(table.displayStatus);
  const statusLabel =
    table.displayStatus === 'closing'
      ? 'out of service'
      : table.displayStatus === 'loading'
        ? 'loading status'
        : table.displayStatus;
  const partyLabel = table.partyName ?? 'Unknown guest';
  const partySize = table.currentStatus.booking?.partySize ?? table.capacity;

  const containerClassName =
    variant === 'floating'
      ? 'absolute right-6 top-24 w-80 z-40 animate-in slide-in-from-right-10 fade-in duration-300'
      : 'relative w-full';

  const cardClassName =
    variant === 'floating'
      ? 'overflow-hidden'
      : variant === 'panel'
        ? 'overflow-hidden h-full'
        : 'overflow-hidden rounded-none border-0 shadow-none';

  return (
    <div className={containerClassName}>
      <Card className={cardClassName}>
        <div className={cn('h-24 relative overflow-hidden flex items-center justify-center', theme.bg)}>
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_rgba(255,255,255,0.4)_1px,_transparent_1px)] [background-size:18px_18px]" />
          <span className="text-4xl font-bold text-white opacity-90">{table.tableNumber}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 h-7 w-7 rounded-full text-white hover:bg-black/20"
            aria-label="Close table details"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Table {table.tableNumber}
                {table.displayType === 'booth' ? (
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full font-normal">Booth</span>
                ) : null}
              </h3>
              <p className="text-sm text-slate-500 capitalize">{statusLabel}</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">{table.capacity}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <MapPin className="w-3.5 h-3.5" />
            <span>{table.zoneName ?? 'No zone'}</span>
            <span className="text-slate-300">•</span>
            <span className="capitalize">{table.seatingType.split('_').join(' ')}</span>
          </div>

          {table.displayStatus === 'seated' || table.displayStatus === 'reserved' ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wide mb-1">Current party</div>
                <div className="font-semibold text-slate-900">{partyLabel}</div>
                {table.timeLabel ? (
                  <div className="text-sm text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {table.displayStatus === 'seated' ? 'Seated at' : 'Reserved at'} {table.timeLabel}
                  </div>
                ) : null}
                <div className="text-xs text-slate-500 mt-1">Party size {partySize}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={onBrowseBookings} disabled={!isOnline}>
                  Browse bookings
                </Button>
                <Button type="button" onClick={onAddBooking} disabled={!isOnline || isLaunchingBooking}>
                  New booking
                </Button>
              </div>
            </div>
          ) : table.displayStatus === 'loading' ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Live status is loading. Table availability may be incomplete for a moment.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={onBrowseBookings} disabled={!isOnline}>
                  Browse bookings
                </Button>
                <Button type="button" onClick={onAddBooking} disabled={!isOnline || isLaunchingBooking}>
                  New booking
                </Button>
              </div>
            </div>
          ) : table.displayStatus === 'available' ? (
            <div className="space-y-3">
              <div className="text-sm text-slate-500 leading-relaxed">
                This table is available for walk-ins or assignment.
              </div>
              <Button type="button" className="w-full" onClick={onAddBooking} disabled={!isOnline || isLaunchingBooking}>
                Assign booking
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-slate-500 leading-relaxed">This table is currently unavailable.</div>
              <div className="text-xs text-slate-400">Check zone status or reopen the table.</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
