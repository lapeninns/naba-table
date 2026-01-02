'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Calendar as CalendarIcon,
    ChevronDown,
    Clock,
    LayoutTemplate,
    Loader2,
    MapPin,
    Minus,
    Plus,
    Search,
    Users,
    Utensils,
    X,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useRestaurantService, useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { useToast } from '@/hooks/use-toast';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import type { TableTimelineSegment } from '@/types/ops';

// --- Utilities ---

function parseTimeToMinutes(timeStr: string | null): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia(query);
        const handleChange = () => setMatches(mediaQuery.matches);
        handleChange();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
}

function formatTimeParam(timestamp: number): string {
    return format(new Date(timestamp), 'HH:mm');
}

function formatMinutes(totalMinutes: number) {
    const minutesInDay = 24 * 60;
    const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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

type FloorPlanStatus = 'available' | 'reserved' | 'seated' | 'closing';
type FloorPlanTableType = 'round' | 'rect' | 'booth';

const getStatusColor = (status: FloorPlanStatus) => {
    switch (status) {
        case 'seated':
            return {
                bg: 'bg-emerald-500',
                stroke: 'border-emerald-600',
                text: 'text-white',
                glow: 'shadow-emerald-500/20'
            };
        case 'reserved':
            return {
                bg: 'bg-amber-400',
                stroke: 'border-amber-500',
                text: 'text-white',
                glow: 'shadow-amber-500/20'
            };
        case 'closing':
            return {
                bg: 'bg-slate-200',
                stroke: 'border-slate-300',
                text: 'text-slate-400',
                glow: 'shadow-none'
            };
        case 'available':
        default:
            return {
                bg: 'bg-white',
                stroke: 'border-slate-200',
                text: 'text-slate-700',
                glow: 'shadow-slate-200/50'
            };
    }
};

// --- UI Components ---

type FloorPlanTableRender = {
    id: string;
    tableNumber: string;
    capacity: number;
    xPercent: number;
    yPercent: number;
    rotation: number;
    displayStatus: FloorPlanStatus;
    displayType: FloorPlanTableType;
    partyName: string | null;
};

type FloorPlanTableInspector = FloorPlanTableRender & {
    seatingType: string;
    zoneName: string | null;
    currentStatus: TableTimelineSegment;
    timeLabel: string | null;
};

const ArchTable = ({
    table,
    isSelected,
    onClick,
    zoom
}: {
    table: FloorPlanTableRender;
    isSelected: boolean;
    onClick: (id: string) => void;
    zoom: number;
}) => {
    const theme = getStatusColor(table.displayStatus);
    const width = table.displayType === 'round' ? 60 : table.displayType === 'booth' ? 70 : table.capacity > 4 ? 90 : 60;
    const height = table.displayType === 'round' ? 60 : table.displayType === 'booth' ? 50 : 60;
    const scale = zoom < 0.8 ? 1.5 : 1;

    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onClick(table.id);
            }}
            className="absolute cursor-pointer transition-all duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
            data-table-id={table.id}
            style={{
                left: `${table.xPercent}%`,
                top: `${table.yPercent}%`,
                transform: `translate(-50%, -50%) rotate(${table.rotation}deg) scale(${isSelected ? 1.1 : 1})`,
                zIndex: isSelected ? 50 : 10,
            }}
            aria-pressed={isSelected}
            aria-label={`Table ${table.tableNumber}`}
        >
            <div
                className={cn(
                    'absolute -inset-4 rounded-full border-2 border-indigo-500 opacity-0 scale-90 transition-all duration-300',
                    isSelected ? 'opacity-100 scale-100' : '',
                )}
            />

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
                    {table.displayStatus === 'seated' ? (
                        <Utensils className="w-3 h-3 text-white/80 mt-1" aria-hidden />
                    ) : null}
                    {table.displayStatus === 'reserved' ? (
                        <Clock className="w-3 h-3 text-white/80 mt-1" aria-hidden />
                    ) : null}
                </div>
            </div>
        </button>
    );
};

const TimeScrubber = ({
    time,
    min,
    max,
    step,
    bars,
    onChange,
    onStep,
    className
}: {
    time: number;
    min: number;
    max: number;
    step: number;
    bars: number[];
    onChange: (next: number) => void;
    onStep: (delta: number) => void;
    className?: string;
}) => {
    const formatted = formatMinutes(time);
    const range = Math.max(1, max - min);
    const playhead = Math.max(0, Math.min(100, ((time - min) / range) * 100));

    return (
        <Card className={cn('w-full max-w-2xl', className)}>
            <CardContent className="flex h-20 items-center gap-4 px-6">
                <div className="flex flex-col items-center min-w-[60px]">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{formatted}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Timeline</span>
                </div>

                <div className="flex-1 relative h-12 flex items-end gap-1 group cursor-crosshair">
                    {bars.map((height, i) => (
                        <div
                            key={i}
                            className={cn(
                                'flex-1 rounded-t-sm transition-all duration-300',
                                i > bars.length * 0.55 && i < bars.length * 0.75 ? 'bg-primary/60' : 'bg-muted'
                            )}
                            style={{ height: `${height}%` }}
                        />
                    ))}

                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={time}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        aria-label="Select time"
                    />

                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none transition-all duration-75"
                        style={{ left: `${playhead}%` }}
                    >
                        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-primary rounded-full shadow-sm" />
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onStep(-step)}
                        aria-label="Step time backward"
                    >
                        <Minus className="w-4 h-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onStep(step)}
                        aria-label="Step time forward"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

const FloatingInspector = ({
    table,
    onClose,
    onAddBooking,
    onBrowseBookings,
    isOnline,
    isLaunchingBooking,
    variant = 'floating'
}: {
    table: FloorPlanTableInspector | null;
    onClose: () => void;
    onAddBooking: () => void;
    onBrowseBookings: () => void;
    isOnline: boolean;
    isLaunchingBooking: boolean;
    variant?: 'floating' | 'sheet' | 'panel';
}) => {
    if (!table) return null;
    const theme = getStatusColor(table.displayStatus);
    const statusLabel = table.displayStatus === 'closing' ? 'out of service' : table.displayStatus;
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
                                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wide mb-1">
                                    Current party
                                </div>
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onBrowseBookings}
                                    disabled={!isOnline}
                                >
                                    Browse bookings
                                </Button>
                                <Button
                                    type="button"
                                    onClick={onAddBooking}
                                    disabled={!isOnline || isLaunchingBooking}
                                >
                                    New booking
                                </Button>
                            </div>
                        </div>
                    ) : table.displayStatus === 'available' ? (
                        <div className="space-y-3">
                            <div className="text-sm text-slate-500 leading-relaxed">
                                This table is available for walk-ins or assignment.
                            </div>
                            <Button
                                type="button"
                                className="w-full"
                                onClick={onAddBooking}
                                disabled={!isOnline || isLaunchingBooking}
                            >
                                Assign booking
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-sm text-slate-500 leading-relaxed">
                                This table is currently unavailable.
                            </div>
                            <div className="text-xs text-slate-400">Check zone status or reopen the table.</div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

// --- Main Component ---

export default function FloorPlanPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { activeRestaurantId } = useOpsSession();
    const isOnline = useOnlineStatus();
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const tableService = useTableInventoryService();
    const zoneService = useZoneService();
    const restaurantService = useRestaurantService();

    const [currentTimeVal, setCurrentTimeVal] = useState(19 * 60 + 30);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const selectedDate = useMemo(() => date ? format(date, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0], [date]);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
    const [isLaunchingBooking, setIsLaunchingBooking] = useState(false);

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
        if (!operatingData) return { min: 11 * 60, max: 23 * 60, periods: [], interval: 15 };

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
    }, [currentTimeVal, timelineConfig.max, timelineConfig.min]);

    // Fetch Zones
    const { data: zones = [] } = useQuery({
        queryKey: activeRestaurantId ? queryKeys.opsTables.zones(activeRestaurantId) : ['ops', 'zones', 'disabled'],
        queryFn: async () => {
            if (!activeRestaurantId) throw new Error('No restaurant ID');
            return zoneService.list(activeRestaurantId);
        },
        enabled: !!activeRestaurantId
    });

    const selectedZoneLabel = useMemo(() => {
        if (selectedZoneId === 'all') return 'All zones';
        return zones.find(zone => zone.id === selectedZoneId)?.name ?? 'Selected zone';
    }, [selectedZoneId, zones]);

    // Fetch Tables (for layout)
    const { data: tablesListResult, isLoading: isLoadingTables } = useQuery({
        queryKey: activeRestaurantId ? queryKeys.opsTables.list(activeRestaurantId) : ['ops', 'tables', 'disabled'],
        queryFn: async () => {
            if (!activeRestaurantId) throw new Error('No restaurant ID');
            return tableService.list(activeRestaurantId);
        },
        enabled: !!activeRestaurantId
    });

    const tables = useMemo(
        () => tablesListResult?.tables ?? [],
        [tablesListResult?.tables]
    );

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

    const timeParam = useMemo(() => formatTimeParam(currentTimestamp), [currentTimestamp]);

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

    const displayTables = useMemo<FloorPlanTableInspector[]>(() => {
        return tablesWithStatus.map((table) => {
            const normalizedStatus = table.currentStatus.state;
            const isInactive =
                !table.active ||
                table.zoneActive === false ||
                (table.status && String(table.status).toLowerCase() !== 'available') ||
                normalizedStatus === 'out_of_service';

            let displayStatus: FloorPlanStatus = 'available';
            if (isInactive) {
                displayStatus = 'closing';
            } else if (
                normalizedStatus === 'reserved' &&
                table.currentStatus.booking?.status === 'checked_in'
            ) {
                displayStatus = 'seated';
            } else if (normalizedStatus === 'reserved' || normalizedStatus === 'hold') {
                displayStatus = 'reserved';
            }

            const displayType: FloorPlanTableType =
                table.seatingType === 'booth' ? 'booth' : table.mobility === 'fixed' ? 'round' : 'rect';

            const partyName = table.currentStatus.booking?.customerName ?? null;

            const timeLabel = table.currentStatus.start
                ? format(new Date(table.currentStatus.start), 'HH:mm')
                : null;

            return {
                ...table,
                displayStatus,
                displayType,
                partyName,
                timeLabel,
                seatingType: table.seatingType ?? 'standard',
                zoneName: table.zoneName ?? null,
            };
        });
    }, [tablesWithStatus]);

    const selectedTable = useMemo(() => {
        if (!selectedTableId) return null;
        return displayTables.find((table) => table.id === selectedTableId) ?? null;
    }, [displayTables, selectedTableId]);

    const histogramBars = useMemo(
        () =>
            Array.from({ length: 48 }, (_, i) => {
                const wave = Math.sin(i / 5) * 18;
                const offset = (i % 6) * 3;
                const height = 34 + wave + offset;
                return Math.max(12, Math.min(88, Math.round(height)));
            }),
        [],
    );

    const handleAddBooking = useCallback(
        (table = selectedTable) => {
            if (!isOnline) {
                toast({
                    title: 'Offline',
                    description: 'Reconnect to open the new booking flow.',
                });
                return;
            }
            if (isLaunchingBooking) return;

            setIsLaunchingBooking(true);

            try {
                const params = new URLSearchParams();
                params.set('date', selectedDate);
                params.set('time', timeParam);

                if (table?.capacity) {
                    params.set('partySize', table.capacity.toString());
                }

                toast({
                    title: 'Opening new booking',
                    description: table ? `Table ${table.tableNumber} · ${timeString}` : `Selected time · ${timeString}`,
                });

                router.push(`/new-bookings?${params.toString()}`);
            } catch (error) {
                console.error('[floor-plan] failed to open new booking', error);
                toast({
                    variant: 'destructive',
                    title: 'Unable to open new booking',
                    description: 'Please try again once you are online.',
                });
                setIsLaunchingBooking(false);
            }
        },
        [isLaunchingBooking, isOnline, router, selectedDate, selectedTable, timeParam, timeString, toast],
    );

    const handleBrowseBookings = useCallback(
        (table = selectedTable) => {
            if (!isOnline) {
                toast({
                    title: 'Offline',
                    description: 'Reconnect to browse bookings.',
                });
                return;
            }

            const params = new URLSearchParams();
            params.set('date', selectedDate);

            if (table) {
                params.set('tableId', table.id);
                params.set('tableLabel', `Table ${table.tableNumber}`);
                params.set('time', timeParam);
            }

            router.push(`/bookings?${params.toString()}`);
        },
        [isOnline, router, selectedDate, selectedTable, timeParam, toast],
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('[data-table-id]')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        hasDraggedRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { ...pan };
        setSelectedTableId(null);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasDraggedRef.current = true;
        }
        setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setIsDragging(false);
    };

    const handleTableClick = (id: string) => {
        if (!hasDraggedRef.current) {
            setSelectedTableId(id === selectedTableId ? null : id);
        }
    };

    // Zoom controls
    const handleZoomIn = () => setZoom((z) => Math.min(2, z + 0.1));
    const handleZoomOut = () => setZoom((z) => Math.max(0.5, z - 0.1));

    const clampTime = useCallback(
        (value: number) => Math.min(timelineConfig.max, Math.max(timelineConfig.min, value)),
        [timelineConfig.max, timelineConfig.min],
    );

    const handleTimeChange = useCallback(
        (value: number) => setCurrentTimeVal(clampTime(value)),
        [clampTime],
    );

    const handleTimeStep = useCallback(
        (delta: number) => setCurrentTimeVal((current) => clampTime(current + delta)),
        [clampTime],
    );

    if (!activeRestaurantId) {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-10">
                <Card className="border-dashed">
                    <CardHeader className="items-center text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                            <LayoutTemplate className="h-6 w-6" aria-hidden />
                        </div>
                        <CardTitle>No restaurant selected</CardTitle>
                        <CardDescription>Select a restaurant to load the floor plan.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (isLoadingTables || isLoadingTimeline) {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-10">
                <Card>
                    <CardHeader className="items-center text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
                        <CardTitle className="text-base font-semibold">Loading floor plan...</CardTitle>
                        <CardDescription>Fetching tables, zones, and live status.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const formattedDate = date ? format(date, 'MMM d, yyyy') : 'Today';

    const inspectorPanel = selectedTable ? (
        <FloatingInspector
            table={selectedTable}
            onClose={() => setSelectedTableId(null)}
            onAddBooking={() => handleAddBooking(selectedTable)}
            onBrowseBookings={() => handleBrowseBookings(selectedTable)}
            isOnline={isOnline}
            isLaunchingBooking={isLaunchingBooking}
            variant="panel"
        />
    ) : (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-base">Table details</CardTitle>
                <CardDescription>Select a table to review bookings and actions.</CardDescription>
            </CardHeader>
        </Card>
    );

    return (
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <LayoutTemplate className="h-5 w-5" aria-hidden />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Floor plan</h1>
                            <p className="text-sm text-muted-foreground">
                                Manage table availability and jump into bookings quickly.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="rounded-md">
                            {selectedZoneLabel}
                        </Badge>
                        <Badge variant="outline" className="rounded-md">
                            {formattedDate}
                        </Badge>
                        <Badge variant="outline" className="rounded-md">
                            {timeString}
                        </Badge>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <LayoutTemplate className="h-4 w-4" />
                                {selectedZoneLabel}
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                            <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                Zones
                            </div>
                            <div className="space-y-1">
                                <Button
                                    type="button"
                                    variant={selectedZoneId === 'all' ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setSelectedZoneId('all')}
                                >
                                    All zones
                                </Button>
                                {zones.map((zone) => (
                                    <Button
                                        key={zone.id}
                                        type="button"
                                        variant={selectedZoneId === zone.id ? 'secondary' : 'ghost'}
                                        className="w-full justify-start"
                                        onClick={() => setSelectedZoneId(zone.id)}
                                    >
                                        {zone.name}
                                    </Button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                {formattedDate}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                        </PopoverContent>
                    </Popover>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search guests, tables..."
                            className="pl-9"
                            aria-label="Search guests or tables"
                        />
                    </div>

                    <Button variant="outline" onClick={() => handleBrowseBookings()} disabled={!isOnline}>
                        Browse bookings
                    </Button>
                    <Button onClick={() => handleAddBooking()} disabled={!isOnline || isLaunchingBooking} aria-busy={isLaunchingBooking}>
                        {isLaunchingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                        New booking
                    </Button>
                </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex flex-col gap-4">
                    <Card className="relative overflow-hidden">
                        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base">Floor canvas</CardTitle>
                                <CardDescription>Drag to pan. Use controls to zoom.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="rounded-md">{selectedZoneLabel}</Badge>
                                <Badge variant="outline" className="rounded-md">{timeString}</Badge>
                            </div>
                        </CardHeader>
                        <Separator />
                        <CardContent className="relative p-0">
                            <div
                                className={cn(
                                    'relative flex h-[65vh] min-h-[520px] w-full items-center justify-center overflow-hidden bg-muted/20 touch-none',
                                    isDragging ? 'cursor-grabbing' : 'cursor-grab'
                                )}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                role="region"
                                aria-label="Floor plan canvas"
                            >
                                <div
                                    className="absolute inset-0 opacity-[0.08] pointer-events-none"
                                    style={{
                                        backgroundImage: `
                                            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                                            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
                                        `,
                                        backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
                                        backgroundPosition: `${pan.x}px ${pan.y}px`,
                                    }}
                                />

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div
                                        className="relative transition-transform duration-75 ease-out will-change-transform"
                                        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                                    >
                                        <div className="relative w-[90vw] max-w-[900px] aspect-[4/3] rounded-[32px] border border-border/60 bg-background shadow-lg">
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-2 bg-muted rounded-b-xl" />
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-2 bg-muted rounded-t-xl" />

                                            {displayTables.map((table) => (
                                                <ArchTable
                                                    key={table.id}
                                                    table={table}
                                                    isSelected={selectedTableId === table.id}
                                                    onClick={handleTableClick}
                                                    zoom={zoom}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <Card className="absolute right-4 top-4 z-20">
                                    <CardContent className="p-1 flex flex-col gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleZoomIn}
                                            aria-label="Zoom in"
                                        >
                                            <ZoomIn className="h-4 w-4" />
                                        </Button>
                                        <Separator />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleZoomOut}
                                            aria-label="Zoom out"
                                        >
                                            <ZoomOut className="h-4 w-4" />
                                        </Button>
                                    </CardContent>
                                </Card>

                                <div className="absolute bottom-4 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-4">
                                    <TimeScrubber
                                        time={currentTimeVal}
                                        min={timelineConfig.min}
                                        max={timelineConfig.max}
                                        step={timelineConfig.interval}
                                        bars={histogramBars}
                                        onChange={handleTimeChange}
                                        onStep={handleTimeStep}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <aside className="hidden lg:block">
                    {inspectorPanel}
                </aside>
            </div>

            {!isDesktop ? (
                <Sheet
                    open={Boolean(selectedTable)}
                    onOpenChange={(open) => {
                        if (!open) setSelectedTableId(null);
                    }}
                >
                    <SheetContent side="bottom" className="h-[85vh] p-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Table details</SheetTitle>
                            <SheetDescription>Review table status and actions.</SheetDescription>
                        </SheetHeader>
                        <FloatingInspector
                            table={selectedTable}
                            onClose={() => setSelectedTableId(null)}
                            onAddBooking={() => handleAddBooking(selectedTable)}
                            onBrowseBookings={() => handleBrowseBookings(selectedTable)}
                            isOnline={isOnline}
                            isLaunchingBooking={isLaunchingBooking}
                            variant="sheet"
                        />
                    </SheetContent>
                </Sheet>
            ) : null}
        </div>
    );
}
