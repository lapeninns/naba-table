/**
 * Utilization Heatmap Component
 * Story 4: Ops Dashboard - Real-time Capacity Visualization
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// =====================================================
// Types
// =====================================================

type SlotData = {
  time: string;
  available: boolean;
  utilizationPercent: number;
  bookedCovers?: number;
  maxCovers?: number;
};

// =====================================================
// Helpers
// =====================================================

function generateTimeSlots(startHour: number = 17, endHour: number = 22, interval: number = 15): string[] {
  const slots: string[] = [];
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      slots.push(time);
      
      // Stop at the end hour
      if (hour === endHour && minute === 0) break;
    }
  }
  
  return slots;
}

function getUtilizationColor(utilizationPercent: number): string {
  if (utilizationPercent >= 100) return "bg-red-600 text-white";
  if (utilizationPercent >= 90) return "bg-red-400 text-white";
  if (utilizationPercent >= 70) return "bg-yellow-400 text-gray-900";
  if (utilizationPercent >= 50) return "bg-green-400 text-gray-900";
  return "bg-green-200 text-gray-700";
}

function getUtilizationLabel(utilizationPercent: number): string {
  if (utilizationPercent >= 100) return "FULL";
  if (utilizationPercent >= 90) return "HIGH";
  if (utilizationPercent >= 70) return "MED";
  return "LOW";
}

// =====================================================
// Main Component
// =====================================================

type UtilizationHeatmapProps = {
  restaurantId: string;
  date: string;
  startHour?: number;
  endHour?: number;
  interval?: number;
  partySize?: number;
  showCounts?: boolean;
};

export default function UtilizationHeatmap({
  restaurantId,
  date,
  startHour = 17,
  endHour = 22,
  interval = 15,
  partySize = 2,
  showCounts = false,
}: UtilizationHeatmapProps) {
  const timeSlots = generateTimeSlots(startHour, endHour, interval);

  // Fetch utilization for all slots
  const { data, isLoading, error } = useQuery({
    queryKey: ["slot-utilization", restaurantId, date, startHour, endHour, interval, partySize],
    queryFn: async () => {
      // Check availability for each time slot (with party size of 2 as baseline)
      const results = await Promise.all(
        timeSlots.map(async (time) => {
          try {
            const response = await fetch(
              `/api/availability?restaurantId=${restaurantId}&date=${date}&time=${time}&partySize=${partySize}`
            );
            
            if (!response.ok) {
              return { time, available: false, utilizationPercent: 0 };
            }
            
            const data = await response.json();
            return {
              time,
              available: data.available,
              utilizationPercent: data.metadata?.utilizationPercent ?? 0,
              bookedCovers: data.metadata?.bookedCovers,
              maxCovers: data.metadata?.maxCovers,
            };
          } catch (error) {
            console.error(`Failed to fetch availability for ${time}`, error);
            return { time, available: false, utilizationPercent: 0 };
          }
        })
      );
      
      return results;
    },
    staleTime: 30_000, // Refresh every 30 seconds
    refetchInterval: 60_000, // Auto-refresh every minute
  });

  // Calculate summary stats
  const avgUtilization = data
    ? Math.round(data.reduce((sum, slot) => sum + slot.utilizationPercent, 0) / data.length)
    : 0;
  
  const fullSlots = data?.filter(slot => slot.utilizationPercent >= 100).length ?? 0;
  const highSlots = data?.filter(slot => slot.utilizationPercent >= 70 && slot.utilizationPercent < 100).length ?? 0;

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertTriangle className="mr-2 h-4 w-4" />
        Failed to load utilization data
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading utilization...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Avg Utilization</div>
            <div className="text-lg font-bold">{avgUtilization}%</div>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Full Slots</div>
          <div className="text-lg font-bold text-red-600">{fullSlots}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">High Utilization</div>
          <div className="text-lg font-bold text-yellow-600">{highSlots}</div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
        {data?.map((slot: SlotData) => {
          const colorClass = getUtilizationColor(slot.utilizationPercent);
          const label = getUtilizationLabel(slot.utilizationPercent);

          return (
            <div
              key={slot.time}
              className={cn(
                "relative rounded-md p-2 text-center transition-all hover:scale-105 cursor-pointer",
                colorClass
              )}
              title={`${slot.time}: ${slot.utilizationPercent}% (${slot.bookedCovers ?? 0}/${slot.maxCovers ?? 'N/A'} covers)`}
            >
              <div className="text-xs font-medium">{slot.time}</div>
              <div className="text-[10px] font-bold mt-0.5">{label}</div>
              <div className="text-[10px] mt-0.5">{slot.utilizationPercent}%</div>
              {showCounts ? (
                <div className="text-[10px]">{`${slot.bookedCovers ?? 0}/${slot.maxCovers ?? '—'}`}</div>
              ) : null}
              
              {/* Overbooked indicator */}
              {slot.utilizationPercent >= 100 && (
                <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  !
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-xs">
        <div className="font-medium text-muted-foreground">Legend:</div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-200" />
          <span>&lt;50%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-400" />
          <span>50-69%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-yellow-400" />
          <span>70-89%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-400" />
          <span>90-99%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-600" />
          <span>100%+ (Full)</span>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-xs text-muted-foreground text-center pt-2">
        Auto-refreshes every minute • Click slot for details
      </div>
    </div>
  );
}
