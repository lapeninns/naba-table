import { cn } from '@/lib/utils';

import type { FloorPlanStatus } from './types';

export function getStatusColor(status: FloorPlanStatus) {
  switch (status) {
    case 'seated':
      return {
        bg: 'bg-emerald-500',
        stroke: 'border-emerald-600',
        text: 'text-white',
        glow: 'shadow-emerald-500/20',
      };
    case 'reserved':
      return {
        bg: 'bg-amber-400',
        stroke: 'border-amber-500',
        text: 'text-white',
        glow: 'shadow-amber-500/20',
      };
    case 'loading':
      return {
        bg: 'bg-slate-50',
        stroke: 'border-slate-200 border-dashed',
        text: 'text-slate-500',
        glow: 'shadow-none',
      };
    case 'closing':
      return {
        bg: 'bg-slate-200',
        stroke: 'border-slate-300',
        text: 'text-slate-400',
        glow: 'shadow-none',
      };
    case 'available':
    default:
      return {
        bg: 'bg-white',
        stroke: 'border-slate-200',
        text: 'text-slate-700',
        glow: 'shadow-slate-200/50',
      };
  }
}

export function getTableFocusRing(isSelected: boolean) {
  return cn(
    'absolute -inset-4 rounded-full border-2 border-indigo-500 opacity-0 scale-90 transition-[opacity,transform] duration-300',
    isSelected ? 'opacity-100 scale-100' : '',
  );
}
