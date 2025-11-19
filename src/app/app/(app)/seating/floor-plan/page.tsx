'use client';

import { useQuery } from '@tanstack/react-query';
import {
    Armchair,
    Calendar as CalendarIcon,
    Clock,
    Info,
    Loader2,
    MapPin,
    Plus,
    Minus,
    Users,
    Utensils,
    X,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    ExternalLink
} from 'lucide-react';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';

import { useRestaurantService, useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useOpsSession, useOpsActiveMembership } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { queryKeys } from '@/lib/query/keys';
import type { TableInventory } from '@/services/ops/tables';
import type { TableTimelineSegment } from '@/types/ops';

// --- Utilities ---

function parseTimeToMinutes(timeStr: string | null): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// --- Logic Helpers ---

function normalizePosition(value: unknown): { x: number; y: number; rotation: number } | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value as Record<string, unknown>;
    const x = typeof record.x === 'number' ? record.x : null;
    const y = typeof record.y === 'number' ? record.y : null;
    if (x === null || y === null) {
        return null;
    }
    const rotation = typeof record.rotation === 'number' ? record.rotation : 0;
    return { x, y, rotation };
}

function getTableStateAtTime(segments: TableTimelineSegment[], timestamp: number): TableTimelineSegment {
    const segment = segments.find(s => {
        const start = new Date(s.start).getTime();
        const end = new Date(s.end).getTime();
        return timestamp >= start && timestamp < end;
    });

    if (segment) return segment;

    // Return a default available segment if none found
    return {
        start: new Date(timestamp).toISOString(),
        end: new Date(timestamp + 3600000).toISOString(),
        state: 'available',
        serviceKey: 'other',
        disabled: false
    } as TableTimelineSegment;
}

function getStatusTheme(state: string) {
    switch (state) {
        case 'reserved':
            return {
                bg: 'bg-rose-50',
                border: 'border-rose-300',
                text: 'text-rose-700',
                fill: 'bg-rose-400',
                shadow: 'shadow-rose-100',
                chair: 'bg-rose-200 border-rose-300'
            };
        case 'hold':
            return {
                bg: 'bg-amber-50',
                border: 'border-amber-300',
                text: 'text-amber-700',
                fill: 'bg-amber-400',
                shadow: 'shadow-amber-100',
                chair: 'bg-amber-200 border-amber-300'
            };
        case 'occupied':
            return {
                bg: 'bg-blue-50',
                border: 'border-blue-300',
                text: 'text-blue-700',
                fill: 'bg-blue-400',
                shadow: 'shadow-blue-100',
                chair: 'bg-blue-200 border-blue-300'
            };
        case 'out_of_service':
            return {
                bg: 'bg-slate-100',
                border: 'border-slate-300',
                text: 'text-slate-700',
                fill: 'bg-slate-400',
                shadow: 'shadow-slate-100',
                chair: 'bg-slate-200 border-slate-300'
            };
        case 'available':
        default:
            return {
                bg: 'bg-emerald-50',
                border: 'border-emerald-300',
                text: 'text-emerald-700',
                fill: 'bg-emerald-400',
                shadow: 'shadow-emerald-100',
                chair: 'bg-emerald-200 border-emerald-300'
            };
    }
}

// --- Main Component ---

export default function FloorPlanApp() {
    const { activeRestaurantId } = useOpsSession();
    const tableService = useTableInventoryService();
    const zoneService = useZoneService();
    const restaurantService = useRestaurantService();
    const activeMembership = useOpsActiveMembership();

    const [currentTimeVal, setCurrentTimeVal] = useState(18.5 * 60); // Default start
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const selectedDate = useMemo(() => date ? format(date, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0], [date]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('all');

    // Zoom & Pan State
    const [zoom, setZoom] = useState(0.75);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // Refs for drag calculations
    const dragStartRef = useRef({ x: 0, y: 0 });
    const panStartRef = useRef({ x: 0, y: 0 });
    const hasDraggedRef = useRef(false);

    // Fetch Operating Hours & Service Periods
    const { data: operatingData } = useQuery({
        queryKey: activeRestaurantId ? ['ops', 'operating-hours', activeRestaurantId] : ['ops', 'operating-hours', 'disabled'],
        queryFn: async () => {
            if (!activeRestaurantId) throw new Error('No restaurant ID');
            const [hours, periods, profile] = await Promise.all([
                restaurantService.getOperatingHours(activeRestaurantId),
                restaurantService.getServicePeriods(activeRestaurantId),
                restaurantService.getProfile(activeRestaurantId)
            ]);
            return { hours, periods, profile };
        },
        enabled: !!activeRestaurantId
    });

    // Calculate Timeline Range & Periods for Selected Date
    const timelineConfig = useMemo(() => {
        if (!operatingData) return { min: 11 * 60, max: 23 * 60, periods: [] };

        const dayOfWeek = new Date(selectedDate).getDay(); // 0 = Sunday
        // Adjust for JS getDay() (0=Sun) vs likely DB (1=Mon...7=Sun or 0=Sun) - Assuming 0=Sun matches for now

        const dailyHours = operatingData.hours.weekly.find(h => h.dayOfWeek === dayOfWeek);
        const periods = operatingData.periods.filter(p => p.dayOfWeek === dayOfWeek);

        let min = 11 * 60;
        let max = 23 * 60;

        if (dailyHours && dailyHours.opensAt && dailyHours.closesAt) {
            min = parseTimeToMinutes(dailyHours.opensAt);
            max = parseTimeToMinutes(dailyHours.closesAt);
            // Handle late night closing (e.g., 01:00)
            if (max < min) max += 24 * 60;
        }

        // Remove buffer to match exact operating hours as requested
        // min = Math.max(0, min - 30);
        // max = Math.min(24 * 60 + 300, max + 30); 

        const interval = operatingData.profile.reservationIntervalMinutes || 15;

        return { min, max, periods, interval };
    }, [operatingData, selectedDate]);

    // Update currentTimeVal if it falls out of range when date changes
    React.useEffect(() => {
        if (currentTimeVal < timelineConfig.min) setCurrentTimeVal(timelineConfig.min);
        if (currentTimeVal > timelineConfig.max) setCurrentTimeVal(timelineConfig.max);
    }, [timelineConfig.min, timelineConfig.max]);

    // Fetch Zones
    const { data: zones = [] } = useQuery({
        queryKey: activeRestaurantId ? queryKeys.opsTables.zones(activeRestaurantId) : ['ops', 'zones', 'disabled'],
        queryFn: async () => {
            if (!activeRestaurantId) throw new Error('No restaurant ID');
            return zoneService.list(activeRestaurantId);
        },
        enabled: !!activeRestaurantId
    });

    // Fetch Tables (for layout)
    const { data: tablesListResult, isLoading: isLoadingTables } = useQuery({
        queryKey: activeRestaurantId ? queryKeys.opsTables.list(activeRestaurantId) : ['ops', 'tables', 'disabled'],
        queryFn: async () => {
            if (!activeRestaurantId) throw new Error('No restaurant ID');
            return tableService.list(activeRestaurantId);
        },
        enabled: !!activeRestaurantId
    });

    const tables = tablesListResult?.tables ?? [];

    // Fetch Timeline (for status)
    const { data: timelineData, isLoading: isLoadingTimeline } = useOpsTableTimeline({
        restaurantId: activeRestaurantId,
        date: selectedDate,
        enabled: !!activeRestaurantId
    });

    const currentTimestamp = useMemo(() => {
        // Use a fixed date for hydration stability, or ensure selectedDate is stable
        const date = new Date(selectedDate + 'T00:00:00');
        return date.getTime() + currentTimeVal * 60000;
    }, [currentTimeVal, selectedDate]);

    const timeString = useMemo(() => {
        return new Date(currentTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }, [currentTimestamp]);

    // Merge table layout with timeline status
    const tablesWithStatus = useMemo(() => {
        let filteredTables = tables;
        if (selectedZoneId !== 'all') {
            filteredTables = tables.filter(t => t.zoneId === selectedZoneId);
        }

        if (!filteredTables.length) return [];

        // Check if any tables have valid positions
        const hasPositions = filteredTables.some(t => normalizePosition(t.position) !== null);

        let positionedTables = filteredTables.map(table => {
            const pos = normalizePosition(table.position);
            return { ...table, pos };
        });

        // If no tables have positions, generate a default grid layout
        if (!hasPositions) {
            const cols = Math.ceil(Math.sqrt(filteredTables.length));
            positionedTables = filteredTables.map((table, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                return {
                    ...table,
                    pos: {
                        x: col * 100 + 50, // Spacing of 100 units
                        y: row * 100 + 50,
                        rotation: 0
                    }
                };
            });
        } else {
            positionedTables = positionedTables.filter(t => t.pos !== null);
        }

        if (positionedTables.length === 0) return [];

        // Calculate bounds for normalization
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        positionedTables.forEach(t => {
            if (t.pos) {
                minX = Math.min(minX, t.pos.x);
                maxX = Math.max(maxX, t.pos.x);
                minY = Math.min(minY, t.pos.y);
                maxY = Math.max(maxY, t.pos.y);
            }
        });

        const rangeX = Math.max(1, maxX - minX);
        const rangeY = Math.max(1, maxY - minY);

        // Add significant padding to the range to avoid tables touching the edges
        // Increased padding to ensure tables are fully visible
        const paddingX = rangeX * 0.15;
        const paddingY = rangeY * 0.15;

        const paddedRangeX = rangeX === 0 ? 100 : rangeX + (paddingX * 2);
        const paddedRangeY = rangeY === 0 ? 100 : rangeY + (paddingY * 2);

        const offsetX = minX - paddingX;
        const offsetY = minY - paddingY;

        return positionedTables.map(table => {
            const timelineRow = timelineData?.tables.find(tr => tr.table.id === table.id);
            const segments = timelineRow?.segments ?? [];
            const currentStatus = getTableStateAtTime(segments, currentTimestamp);

            // Normalize to 0-100%
            // If range is 0 (single table), center it
            let xPercent = 50;
            let yPercent = 50;

            if (rangeX > 0) {
                xPercent = ((table.pos!.x - offsetX) / paddedRangeX) * 100;
            }
            if (rangeY > 0) {
                yPercent = ((table.pos!.y - offsetY) / paddedRangeY) * 100;
            }

            // Clamp values to be safe
            xPercent = Math.max(2, Math.min(98, xPercent));
            yPercent = Math.max(2, Math.min(98, yPercent));

            return {
                ...table,
                xPercent,
                yPercent,
                rotation: table.pos!.rotation,
                currentStatus,
                segments
            };
        });
    }, [tables, timelineData, currentTimestamp, selectedZoneId]);

    // Identify merged table groups (tables assigned to the same booking)
    const mergedGroups = useMemo(() => {
        const groups = new Map<string, typeof tablesWithStatus>();

        tablesWithStatus.forEach(table => {
            const booking = table.currentStatus.booking;
            if (booking && booking.tableIds && booking.tableIds.length > 1) {
                if (!groups.has(booking.id)) {
                    groups.set(booking.id, []);
                }
                groups.get(booking.id)!.push(table);
            }
        });

        // Filter to only include groups where multiple tables are visible on this floor plan
        const visibleGroups = new Map<string, typeof tablesWithStatus>();
        groups.forEach((groupTables, bookingId) => {
            if (groupTables.length > 1) {
                visibleGroups.set(bookingId, groupTables);
            }
        });

        return visibleGroups;
    }, [tablesWithStatus]);

    const selectedTableData = useMemo(() => {
        if (!selectedTableId) return null;
        const table = tablesWithStatus.find(t => t.id === selectedTableId);
        if (!table) return null;
        return table;
    }, [selectedTableId, tablesWithStatus]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;
        setIsDragging(true);
        hasDraggedRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { ...pan };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasDraggedRef.current = true;
        }
        setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleTableClick = (id: string) => {
        if (!hasDraggedRef.current) {
            setSelectedTableId(id === selectedTableId ? null : id);
        }
    };

    // Zoom controls
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
    const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    if (!activeRestaurantId) {
        return (
            <div className="flex h-[calc(100vh-8rem)] items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-slate-900">No Restaurant Selected</h2>
                    <p className="text-slate-500">Please select a restaurant to view the floor plan.</p>
                </div>
            </div>
        );
    }

    if (isLoadingTables || isLoadingTimeline) {
        return (
            <div className="flex h-[calc(100vh-8rem)] items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    <p className="text-slate-500">Loading floor plan...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100dvh-4rem)] flex-col bg-slate-100 text-slate-900 overflow-hidden font-sans rounded-xl border border-slate-200 shadow-sm">
            {/* Top Bar */}
            <header className="flex flex-col sm:flex-row sm:h-16 shrink-0 items-start sm:items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-2 sm:py-0 shadow-sm z-10 gap-2 sm:gap-0">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <Utensils className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold leading-tight">Floor Plan</h1>
                        <p className="text-xs font-medium text-slate-500">{date ? format(date, "MMM d, yyyy") : 'Select Date'} • Service Overview</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Zone Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-[200px] sm:max-w-none scrollbar-hide">
                        <button
                            onClick={() => setSelectedZoneId('all')}
                            className={cn(
                                "px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                selectedZoneId === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            All
                        </button>
                        {zones.map(zone => (
                            <button
                                key={zone.id}
                                onClick={() => setSelectedZoneId(zone.id)}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                                    selectedZoneId === zone.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                {zone.name}
                            </button>
                        ))}
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[180px] sm:w-[240px] justify-start text-left font-normal",
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </header>

            <main className="flex flex-1 overflow-hidden relative">

                {/* --- Left: The Floor Plan Canvas --- */}
                <div
                    className={cn(
                        "relative flex-1 overflow-hidden bg-[#f8fafc] flex items-center justify-center pb-32 cursor-grab active:cursor-grabbing",
                        isDragging ? "cursor-grabbing" : "cursor-grab"
                    )}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >

                    {/* Grid Background (Optional, but adds texture) */}
                    <div className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />

                    {/* Floor Container */}
                    <div
                        className="relative w-full max-w-5xl aspect-[1.4/1] rounded-3xl shadow-2xl bg-white/40 backdrop-blur-sm border border-white/60 overflow-hidden select-none ring-1 ring-slate-900/5 transition-transform duration-75 ease-out"
                        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                    >

                        {/* Render Merged Table Connection Lines */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
                            {Array.from(mergedGroups.entries()).map(([bookingId, groupTables]) => {
                                // Draw lines connecting all tables in the group
                                const lines = [];
                                const theme = getStatusTheme('reserved');

                                for (let i = 0; i < groupTables.length - 1; i++) {
                                    for (let j = i + 1; j < groupTables.length; j++) {
                                        const table1 = groupTables[i];
                                        const table2 = groupTables[j];

                                        lines.push(
                                            <line
                                                key={`${bookingId}-${table1.id}-${table2.id}`}
                                                x1={`${table1.xPercent}%`}
                                                y1={`${table1.yPercent}%`}
                                                x2={`${table2.xPercent}%`}
                                                y2={`${table2.yPercent}%`}
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeDasharray="4 4"
                                                className={cn("opacity-40", theme.text)}
                                            />
                                        );
                                    }
                                }

                                return lines;
                            })}
                        </svg>

                        {/* Render Tables */}
                        {tablesWithStatus.map((table) => {
                            const status = table.currentStatus;
                            const isSelected = selectedTableId === table.id;
                            const theme = getStatusTheme(status.state);

                            // Check if this table is part of a merged group
                            const booking = status.booking;
                            const isMerged = booking && booking.tableIds && booking.tableIds.length > 1;
                            const mergedTableCount = isMerged && booking?.tableIds ? booking.tableIds.length : 0;

                            // User Request: Movable = Rect/Square, Fixed = Circle/Oval
                            const isRound = table.mobility === 'fixed';
                            const capacity = table.capacity || 2;

                            // Calculate size based on capacity
                            let widthPercent = 5;
                            let aspectRatio = '1/1';

                            if (isRound) {
                                if (capacity <= 2) widthPercent = 4;
                                else if (capacity <= 4) widthPercent = 5.5;
                                else if (capacity <= 6) widthPercent = 7;
                                else widthPercent = 8.5;
                                aspectRatio = '1/1';
                            } else {
                                // Rectangular / Square
                                if (capacity <= 2) {
                                    widthPercent = 4;
                                    aspectRatio = '1/1'; // Square
                                } else if (capacity <= 4) {
                                    widthPercent = 6;
                                    aspectRatio = '1.4/1'; // Standard Rect
                                } else if (capacity <= 6) {
                                    widthPercent = 8;
                                    aspectRatio = '1.8/1'; // Long Rect
                                } else {
                                    widthPercent = 10;
                                    aspectRatio = '2.2/1'; // Banquet
                                }
                            }

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => handleTableClick(table.id)}
                                    className={cn(
                                        "absolute group transition-all duration-500 ease-out flex items-center justify-center z-10",
                                        isSelected ? "z-20 scale-110" : "hover:scale-105"
                                    )}
                                    style={{
                                        left: `${table.xPercent}%`,
                                        top: `${table.yPercent}%`,
                                        width: `${widthPercent}%`,
                                        aspectRatio: aspectRatio,
                                        transform: `rotate(${table.rotation}deg)`
                                    }}
                                >
                                    {/* 1. The Table Surface */}
                                    <div className={cn(
                                        "absolute inset-0 shadow-md transition-all duration-300",
                                        isRound ? "rounded-full" : "rounded-lg",
                                        theme.bg,
                                        theme.border,
                                        "border-2",
                                        isMerged && "ring-2 ring-offset-1 ring-current/30"
                                    )}>
                                        {/* Inner Gradient/Fill */}
                                        <div className={cn(
                                            "absolute inset-2 opacity-20 rounded-full",
                                            theme.fill
                                        )} />

                                        {/* Label */}
                                        <div className={cn(
                                            "absolute inset-0 flex flex-col items-center justify-center",
                                            theme.text
                                        )}>
                                            <span className="text-[8px] sm:text-[10px] font-bold leading-none">{table.tableNumber}</span>
                                            {status.state === 'reserved' && !isMerged && (
                                                <div className={cn("w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full mt-0.5", theme.fill)} />
                                            )}
                                            {isMerged && (
                                                <div className="text-[7px] sm:text-[8px] font-bold mt-0.5 px-1 py-0.5 rounded-full bg-white/30">
                                                    {mergedTableCount}x
                                                </div>
                                            )}
                                        </div>

                                        {/* Merge Indicator Badge (top-right corner) */}
                                        {isMerged && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white border-2 border-current flex items-center justify-center shadow-sm">
                                                <svg className="w-1.5 h-1.5 sm:w-2 sm:h-2" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM2 2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H2z"/>
                                                    <path d="M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V4z"/>
                                                </svg>
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. The Chairs */}
                                    {isRound ? (
                                        // Round Table Chairs
                                        Array.from({ length: Math.min(capacity, 8) }).map((_, i) => {
                                            const count = Math.min(capacity, 8);
                                            const angle = (i * 360) / count;
                                            return (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        "absolute w-1/3 h-1/3 rounded-full border shadow-sm transition-colors",
                                                        theme.chair
                                                    )}
                                                    style={{
                                                        top: '50%',
                                                        left: '50%',
                                                        transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -160%)`
                                                    }}
                                                />
                                            );
                                        })
                                    ) : (
                                        // Rectangular Table Chairs (Distributed Top/Bottom)
                                        <>
                                            {/* Top Chairs */}
                                            <div className="absolute -top-1/2 left-0 w-full h-1/2 flex justify-around items-end px-[10%] pointer-events-none">
                                                {Array.from({ length: Math.ceil(capacity / 2) }).map((_, i) => (
                                                    <div
                                                        key={`top-${i}`}
                                                        className={cn(
                                                            "h-2/3 w-1/2 max-w-[30%] rounded-t-md border shadow-sm mx-0.5",
                                                            theme.chair
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            {/* Bottom Chairs */}
                                            <div className="absolute -bottom-1/2 left-0 w-full h-1/2 flex justify-around items-start px-[10%] pointer-events-none">
                                                {Array.from({ length: Math.floor(capacity / 2) }).map((_, i) => (
                                                    <div
                                                        key={`bottom-${i}`}
                                                        className={cn(
                                                            "h-2/3 w-1/2 max-w-[30%] rounded-b-md border shadow-sm mx-0.5",
                                                            theme.chair
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Zoom Controls UI */}
                    <div className="absolute top-6 left-6 flex flex-col gap-1 bg-white/90 backdrop-blur-md shadow-lg border border-slate-200/60 rounded-xl p-1.5 z-50 no-drag">
                        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 hover:bg-slate-100 text-slate-700 rounded-lg">
                            <Plus className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 hover:bg-slate-100 text-slate-700 rounded-lg">
                            <Minus className="w-4 h-4" />
                        </Button>
                        <div className="h-px bg-slate-200 mx-2 my-0.5" />
                        <Button variant="ghost" size="icon" onClick={handleReset} className="h-8 w-8 hover:bg-slate-100 text-slate-700 rounded-lg">
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* Time Scrubber Floating Control */}
                    <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 w-[95%] sm:w-full max-w-xl px-2 sm:px-6 z-40 no-drag">
                        <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl p-3 sm:p-4 flex items-center gap-4 sm:gap-6">
                            <div className="flex flex-col items-center min-w-[80px] sm:min-w-[100px] border-r border-slate-100 pr-4 sm:pr-6">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Time</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900 tracking-tight">
                                        {new Date(currentTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s[AP]M/, '')}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">
                                        {new Date(currentTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).slice(-2)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 relative pt-4 pb-2">
                                {/* Service Periods Background */}
                                <div className="absolute top-0 left-0 w-full h-1.5 flex rounded-full overflow-hidden bg-slate-100">
                                    {timelineConfig.periods.map((period, idx) => {
                                        const start = parseTimeToMinutes(period.startTime);
                                        const end = parseTimeToMinutes(period.endTime);
                                        const range = timelineConfig.max - timelineConfig.min;
                                        const left = ((start - timelineConfig.min) / range) * 100;
                                        const width = ((end - start) / range) * 100;

                                        return (
                                            <div
                                                key={idx}
                                                className="absolute h-full bg-slate-200"
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Service Period Labels */}
                                <div className="absolute -top-5 left-0 w-full h-full pointer-events-none">
                                    {timelineConfig.periods.map((period, idx) => {
                                        const start = parseTimeToMinutes(period.startTime);
                                        const end = parseTimeToMinutes(period.endTime);
                                        const range = timelineConfig.max - timelineConfig.min;
                                        const left = ((start - timelineConfig.min) / range) * 100;
                                        const width = ((end - start) / range) * 100;

                                        return (
                                            <div
                                                key={idx}
                                                className="absolute text-center"
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            >
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap px-1">
                                                    {period.name}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Custom Slider */}
                                <div className="relative flex w-full touch-none select-none items-center h-6">
                                    {/* Track */}
                                    <div className="absolute w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-slate-900 transition-all duration-75 ease-out"
                                            style={{ width: `${((currentTimeVal - timelineConfig.min) / (timelineConfig.max - timelineConfig.min)) * 100}%` }}
                                        />
                                    </div>

                                    <input
                                        type="range"
                                        min={timelineConfig.min}
                                        max={timelineConfig.max}
                                        step={timelineConfig.interval}
                                        value={currentTimeVal}
                                        onChange={(e) => setCurrentTimeVal(parseFloat(e.target.value))}
                                        className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                                    />

                                    {/* Thumb Bubble */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 h-6 w-6 bg-slate-900 rounded-full shadow-xl border-2 border-white z-10 pointer-events-none transition-all duration-75 ease-out flex items-center justify-center"
                                        style={{ left: `${((currentTimeVal - timelineConfig.min) / (timelineConfig.max - timelineConfig.min)) * 100}%`, transform: 'translate(-50%, -50%)' }}
                                    >
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />

                                        {/* Floating Time Label */}
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                            {new Date(currentTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-500 rotate-45"></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative flex justify-between mt-2 text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                                    {(() => {
                                        // Generate hourly labels
                                        const startHour = Math.ceil(timelineConfig.min / 60);
                                        const endHour = Math.floor(timelineConfig.max / 60);
                                        const hours = [];

                                        // If range is too large, show every 2 hours
                                        const step = (endHour - startHour) > 12 ? 2 : 1;

                                        for (let h = startHour; h <= endHour; h += step) {
                                            hours.push(h * 60);
                                        }

                                        return hours.map((minutes) => {
                                            const date = new Date();
                                            date.setHours(0, minutes, 0, 0);
                                            // Calculate position percentage
                                            const range = timelineConfig.max - timelineConfig.min;
                                            const left = ((minutes - timelineConfig.min) / range) * 100;

                                            // Only show if within bounds (0-100%)
                                            if (left < 0 || left > 100) return null;

                                            return (
                                                <span
                                                    key={minutes}
                                                    className="absolute transform -translate-x-1/2"
                                                    style={{ left: `${left}%` }}
                                                >
                                                    {date.toLocaleTimeString([], { hour: 'numeric' })}
                                                </span>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* --- Right: Inspector Panel --- */}
                <div className={cn(
                    "absolute right-0 top-0 h-full w-full sm:w-80 bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 z-30",
                    selectedTableId ? "translate-x-0" : "translate-x-full"
                )}>
                    {selectedTableData && (
                        <div className="h-full flex flex-col">
                            {/* Panel Header */}
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Table {selectedTableData.tableNumber}</h2>
                                        <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {selectedTableData.zoneName || 'No Zone'}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedTableId(null)} className="-mr-2 -mt-2">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex gap-3 mt-4 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-xs font-medium bg-white px-2.5 py-1.5 rounded border border-slate-200 text-slate-600">
                                        <Users className="h-3.5 w-3.5" />
                                        {selectedTableData.capacity} Seats
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium bg-white px-2.5 py-1.5 rounded border border-slate-200 text-slate-600">
                                        <Armchair className="h-3.5 w-3.5" />
                                        <span className="capitalize">{selectedTableData.seatingType.replace('_', ' ')}</span>
                                    </div>
                                    {selectedTableData.currentStatus.booking?.tableIds && selectedTableData.currentStatus.booking.tableIds.length > 1 && (
                                        <div className="flex items-center gap-1.5 text-xs font-medium bg-rose-100 px-2.5 py-1.5 rounded border border-rose-300 text-rose-700">
                                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM2 2a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H2z"/>
                                                <path d="M2.5 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V4z"/>
                                            </svg>
                                            Merged ({selectedTableData.currentStatus.booking.tableIds.length} tables)
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Panel Content */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="mb-6">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                        Status at {timeString}
                                    </h3>

                                    {selectedTableData.currentStatus.state === 'reserved' ? (
                                        <div className="bg-rose-50 border border-rose-100 rounded-xl overflow-hidden">
                                            <div className="p-4 border-b border-rose-100/50 flex justify-between items-start">
                                                <div>
                                                    <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Reserved</span>
                                                    <h4 className="text-lg font-bold text-rose-900 mt-1">
                                                        {selectedTableData.currentStatus.booking?.customerName || 'Unknown Guest'}
                                                    </h4>
                                                </div>
                                                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-rose-500 text-white">
                                                    p{selectedTableData.currentStatus.booking?.partySize}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white/50 space-y-3">
                                                <div className="flex items-center gap-3 text-sm text-rose-900/80">
                                                    <Clock className="h-4 w-4 text-rose-400" />
                                                    <span>
                                                        {new Date(selectedTableData.currentStatus.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} -
                                                        {new Date(selectedTableData.currentStatus.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Customer Contact Info */}
                                                {(selectedTableData.currentStatus.booking?.customerEmail || selectedTableData.currentStatus.booking?.customerPhone) && (
                                                    <div className="pt-2 border-t border-rose-100/50 space-y-1.5">
                                                        {selectedTableData.currentStatus.booking?.customerEmail && (
                                                            <div className="flex items-center gap-2 text-xs text-rose-800">
                                                                <span className="font-medium text-rose-500">Email:</span>
                                                                <a href={`mailto:${selectedTableData.currentStatus.booking.customerEmail}`} className="hover:underline">
                                                                    {selectedTableData.currentStatus.booking.customerEmail}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {selectedTableData.currentStatus.booking?.customerPhone && (
                                                            <div className="flex items-center gap-2 text-xs text-rose-800">
                                                                <span className="font-medium text-rose-500">Phone:</span>
                                                                <a href={`tel:${selectedTableData.currentStatus.booking.customerPhone}`} className="hover:underline">
                                                                    {selectedTableData.currentStatus.booking.customerPhone}
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Booking Notes */}
                                                {selectedTableData.currentStatus.booking?.notes && (
                                                    <div className="pt-2 border-t border-rose-100/50">
                                                        <div className="text-xs font-medium text-rose-500 mb-1">Notes</div>
                                                        <p className="text-xs text-rose-800 italic bg-rose-50/50 p-2 rounded border border-rose-100">
                                                            "{selectedTableData.currentStatus.booking.notes}"
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Merged Tables List */}
                                                {selectedTableData.currentStatus.booking?.tableIds && selectedTableData.currentStatus.booking.tableIds.length > 1 && (
                                                    <div className="pt-2 border-t border-rose-100/50">
                                                        <div className="text-xs font-medium text-rose-500 mb-2">Merged Tables ({selectedTableData.currentStatus.booking.tableIds.length})</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {selectedTableData.currentStatus.booking.tableIds.map((tableId) => {
                                                                const mergedTable = tablesWithStatus.find(t => t.id === tableId);
                                                                const isCurrentTable = tableId === selectedTableData.id;
                                                                return mergedTable ? (
                                                                    <button
                                                                        key={tableId}
                                                                        onClick={() => !isCurrentTable && setSelectedTableId(tableId)}
                                                                        className={cn(
                                                                            "px-2 py-1 text-xs font-semibold rounded border transition-colors",
                                                                            isCurrentTable
                                                                                ? "bg-rose-500 text-white border-rose-600 cursor-default"
                                                                                : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                                                                        )}
                                                                    >
                                                                        {mergedTable.tableNumber} ({mergedTable.capacity})
                                                                    </button>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : selectedTableData.currentStatus.state === 'available' ? (
                                        <div className="text-center py-8 border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50/30">
                                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                                                <Plus className="h-6 w-6" />
                                            </div>
                                            <h4 className="font-medium text-emerald-900">Table Available</h4>
                                            <p className="text-sm text-emerald-600/80 mt-1 mb-4 px-4">
                                                This table is free at {timeString}.
                                            </p>
                                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                Walk-in Seating
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
                                                    {selectedTableData.currentStatus.state === 'hold' ? <Clock className="h-5 w-5 text-slate-500" /> : <X className="h-5 w-5 text-slate-500" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-700 capitalize">
                                                        {selectedTableData.currentStatus.state.replace('_', ' ')}
                                                    </h4>
                                                    <p className="text-xs text-slate-500">
                                                        Until {new Date(selectedTableData.currentStatus.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Upcoming for this table */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                        Coming Up Next
                                    </h3>
                                    <div className="space-y-2">
                                        {selectedTableData.segments
                                            .filter((s: TableTimelineSegment) => new Date(s.start).getTime() > currentTimestamp)
                                            .slice(0, 3)
                                            .map((seg: TableTimelineSegment, idx: number) => (
                                                <div key={idx} className="flex items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm text-sm">
                                                    <div className="w-16 text-xs font-bold text-slate-500">
                                                        {new Date(seg.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                    </div>
                                                    <div className="flex-1 pl-3 border-l border-slate-100">
                                                        {seg.state === 'reserved' ? (
                                                            <span className="font-medium text-slate-900">{seg.booking?.customerName} (p{seg.booking?.partySize})</span>
                                                        ) : (
                                                            <span className="text-slate-500 capitalize italic">{seg.state.replace('_', ' ')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        {selectedTableData.segments.filter((s: TableTimelineSegment) => new Date(s.start).getTime() > currentTimestamp).length === 0 && (
                                            <p className="text-sm text-slate-400 italic">No more activity for today.</p>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>

            </main>
        </div >
    );
}
