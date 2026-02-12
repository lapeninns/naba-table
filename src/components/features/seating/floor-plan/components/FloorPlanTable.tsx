import { Clock, Utensils } from 'lucide-react';

import { cn } from '@/lib/utils';

import { getStatusColor, getTableFocusRing } from '../lib/status';

import type { FloorPlanTableInspector } from '../lib/types';

export function FloorPlanTable({
  table,
  isSelected,
  onClick,
  zoom,
}: {
  table: FloorPlanTableInspector;
  isSelected: boolean;
  onClick: (id: string) => void;
  zoom: number;
}) {
  const theme = getStatusColor(table.displayStatus);
  const width =
    table.displayType === 'round' ? 60 : table.displayType === 'booth' ? 70 : table.capacity > 4 ? 90 : 60;
  const height = table.displayType === 'round' ? 60 : table.displayType === 'booth' ? 50 : 60;
  const scale = zoom < 0.8 ? 1.5 : 1;

  const ariaLabel = (() => {
    const statusLabel =
      table.displayStatus === 'closing'
        ? 'out of service'
        : table.displayStatus === 'loading'
          ? 'loading status'
          : table.displayStatus;
    const parts = [`Table ${table.tableNumber}`, statusLabel];
    if (table.partyName) parts.push(table.partyName);
    if (table.timeLabel) parts.push(table.timeLabel);
    return parts.join(', ');
  })();

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(table.id);
      }}
      className="absolute cursor-pointer transition-[transform,box-shadow] duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
      data-table-id={table.id}
      style={{
        left: `${table.xPercent}%`,
        top: `${table.yPercent}%`,
        transform: `translate(-50%, -50%) rotate(${table.rotation}deg) scale(${isSelected ? 1.1 : 1})`,
        zIndex: isSelected ? 50 : 10,
      }}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
    >
      <div className={getTableFocusRing(isSelected)} />

      {table.displayType !== 'booth' ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute -top-3 w-8 h-2 bg-slate-300 rounded-full opacity-50" />
          <div className="absolute -bottom-3 w-8 h-2 bg-slate-300 rounded-full opacity-50" />
          {table.capacity > 2 ? (
            <>
              <div className="absolute -left-3 w-2 h-8 bg-slate-300 rounded-full opacity-50" />
              <div className="absolute -right-3 w-2 h-8 bg-slate-300 rounded-full opacity-50" />
            </>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'relative flex items-center justify-center border-2 shadow-lg transition-colors duration-300',
          theme.bg,
          theme.stroke,
          theme.glow,
        )}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: table.displayType === 'round' ? '50%' : '12px',
        }}
      >
        <div
          className="flex flex-col items-center"
          style={{ transform: `rotate(-${table.rotation}deg) scale(${scale})` }}
        >
          <span className={cn('text-sm font-bold leading-none', theme.text)}>{table.tableNumber}</span>
          {zoom > 0.6 && table.partyName ? (
            <div className="absolute -bottom-6 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-md">
              {table.partyName}
            </div>
          ) : null}
          {table.displayStatus === 'seated' ? <Utensils className="w-3 h-3 text-white/80 mt-1" aria-hidden /> : null}
          {table.displayStatus === 'reserved' ? <Clock className="w-3 h-3 text-white/80 mt-1" aria-hidden /> : null}
        </div>
      </div>
    </button>
  );
}
