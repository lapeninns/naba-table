'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Calendar as CalendarIcon,
    Loader2,
    Map as MapIcon,
    MapPin,
    Minus,
    Plus,
    RotateCcw,
    X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRestaurantService, useTableInventoryService, useZoneService } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsTableTimeline } from '@/hooks/ops/useOpsTableTimeline';
import { useToast } from '@/hooks/use-toast';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES } from '@/utils/ops/bookings';

import type { TableTimelineSegment } from '@/types/ops';

// --- Utilities ---

function parseTimeToMinutes(timeStr: string | null): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);

    React.useEffect(() => {
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

function formatMinutesLabel(totalMinutes: number) {
    const minutesInDay = 24 * 60;
    const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
    const date = new Date();
    date.setHours(0, normalized, 0, 0);
    return date.toLocaleTimeString([], { hour: 'numeric' });
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

export default function FloorPlanPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { activeRestaurantId } = useOpsSession();
    const isOnline = useOnlineStatus();
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const tableService = useTableInventoryService();
    const zoneService = useZoneService();
    const restaurantService = useRestaurantService();

    const [currentTimeVal, setCurrentTimeVal] = useState(18.5 * 60); // Default start
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

    const statusCounts = useMemo(() => {
        const counts = {
            available: 0,
            reserved: 0,
            hold: 0,
            out_of_service: 0,
        };

        tablesWithStatus.forEach(table => {
            const state = table.currentStatus.state;
            if (state === 'available') counts.available += 1;
            if (state === 'reserved') counts.reserved += 1;
            if (state === 'hold') counts.hold += 1;
            if (state === 'out_of_service') counts.out_of_service += 1;
        });

        return counts;
    }, [tablesWithStatus]);

    const legendThemes = useMemo(
        () => ({
            available: getStatusTheme('available'),
            reserved: getStatusTheme('reserved'),
            hold: getStatusTheme('hold'),
            out_of_service: getStatusTheme('out_of_service'),
        }),
        [],
    );

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

    const handleAddBooking = useCallback(
        (table = selectedTableData) => {
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
        [isLaunchingBooking, isOnline, router, selectedDate, selectedTableData, timeParam, timeString, toast],
    );

    const handleBrowseBookings = useCallback(
        (table = selectedTableData) => {
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
                params.set('windowMode', 'window');
                params.set('windowMinutes', String(DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES));
            } else {
                params.set('windowMode', 'day');
            }

            router.push(`/bookings?${params.toString()}`);
        },
        [isOnline, router, selectedDate, selectedTableData, timeParam, toast],
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        hasDraggedRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = { ...pan };
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
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
    const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    const inspectorContent = selectedTableData ? (() => {
        const status = selectedTableData.currentStatus;
        const theme = getStatusTheme(status.state);
        const booking = status.booking;
        const mergedTableIds = booking?.tableIds ?? [];
        const hasMergedTables = mergedTableIds.length > 1;

        return (
            <div className="flex h-full flex-col">
                <div className="border-b border-border/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Table</p>
                            <div className="text-xl font-semibold text-foreground">Table {selectedTableData.tableNumber}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="flex items-center gap-1 rounded-md border-border/60">
                                    <MapPin className="h-3 w-3" />
                                    {selectedTableData.zoneName || 'No zone'}
                                </Badge>
                                <Badge variant="secondary" className="rounded-md">
                                    {selectedTableData.capacity} seats
                                </Badge>
                                <Badge variant="outline" className="rounded-md capitalize">
                                    {selectedTableData.seatingType.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>
                        {isDesktop ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedTableId(null)}
                                className="h-8 w-8"
                                aria-label="Close table details"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            onClick={() => handleAddBooking(selectedTableData)}
                            disabled={!isOnline || isLaunchingBooking}
                            aria-busy={isLaunchingBooking}
                        >
                            {isLaunchingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                            Add booking
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBrowseBookings(selectedTableData)}
                            disabled={!isOnline}
                        >
                            Browse bookings
                        </Button>
                    </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Status at {timeString}
                            </span>
                            <Badge variant="outline" className={cn("rounded-md border border-transparent capitalize", theme.bg, theme.text)}>
                                {status.state.replace('_', ' ')}
                            </Badge>
                        </div>

                        {status.state === 'reserved' ? (
                            <div className="mt-3 space-y-3 text-sm text-foreground">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold">{booking?.customerName || 'Unknown guest'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(status.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                                            {new Date(status.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="rounded-md text-xs font-semibold">
                                        p{booking?.partySize ?? selectedTableData.capacity}
                                    </Badge>
                                </div>

                                {(booking?.customerEmail || booking?.customerPhone) ? (
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        {booking?.customerEmail ? (
                                            <div>Email: {booking.customerEmail}</div>
                                        ) : null}
                                        {booking?.customerPhone ? (
                                            <div>Phone: {booking.customerPhone}</div>
                                        ) : null}
                                    </div>
                                ) : null}

                                {booking?.notes ? (
                                    <div className="rounded-lg border border-border/60 bg-background p-2 text-xs text-muted-foreground">
                                        “{booking.notes}”
                                    </div>
                                ) : null}

                                {hasMergedTables ? (
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            Merged tables
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {mergedTableIds.map((tableId) => {
                                                const mergedTable = tablesWithStatus.find(t => t.id === tableId);
                                                const isCurrent = tableId === selectedTableData.id;
                                                if (!mergedTable) return null;
                                                return (
                                                    <Button
                                                        key={tableId}
                                                        size="sm"
                                                        variant={isCurrent ? "default" : "outline"}
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => !isCurrent && setSelectedTableId(tableId)}
                                                    >
                                                        {mergedTable.tableNumber} ({mergedTable.capacity})
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : status.state === 'available' ? (
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                                <p>This table is free at {timeString}.</p>
                                <Button
                                    size="sm"
                                    onClick={() => handleAddBooking(selectedTableData)}
                                    disabled={!isOnline || isLaunchingBooking}
                                    aria-busy={isLaunchingBooking}
                                >
                                    {isLaunchingBooking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                                    Add booking
                                </Button>
                            </div>
                        ) : (
                            <div className="mt-3 text-sm text-muted-foreground">
                                <p className="capitalize">{status.state.replace('_', ' ')}</p>
                                <p className="text-xs">
                                    Until {new Date(status.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coming up next</p>
                        <div className="space-y-2">
                            {selectedTableData.segments
                                .filter((s: TableTimelineSegment) => new Date(s.start).getTime() > currentTimestamp)
                                .slice(0, 3)
                                .map((seg: TableTimelineSegment, idx: number) => (
                                    <div key={idx} className="rounded-lg border border-border/60 bg-background p-3 text-sm">
                                        <div className="text-xs font-medium text-muted-foreground">
                                            {new Date(seg.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                        <div className="mt-1 text-foreground">
                                            {seg.state === 'reserved'
                                                ? `${seg.booking?.customerName ?? 'Guest'} (p${seg.booking?.partySize ?? '?'})`
                                                : seg.state.replace('_', ' ')}
                                        </div>
                                    </div>
                                ))}
                            {selectedTableData.segments.filter((s: TableTimelineSegment) => new Date(s.start).getTime() > currentTimestamp).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No more activity for today.</p>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        );
    })() : (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <MapIcon className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm">Select a table to review bookings and actions.</p>
        </div>
    );

    if (!activeRestaurantId) {
        return (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-10">
                <Card className="border-dashed">
                    <CardHeader className="items-center text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                            <MapIcon className="h-6 w-6" />
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
                        <CardTitle className="text-base font-semibold">Loading floor plan…</CardTitle>
                        <CardDescription>Fetching tables, zones, and live status.</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 px-3 py-6 sm:px-6 lg:px-8">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <MapIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Floor plan</h1>
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
                            {date ? format(date, 'MMM d, yyyy') : 'Today'}
                        </Badge>
                        <Badge variant="outline" className="rounded-md">
                            {timeString}
                        </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className={cn("rounded-md border", legendThemes.available.bg, legendThemes.available.border, legendThemes.available.text)}>
                            Available {statusCounts.available}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-md border", legendThemes.reserved.bg, legendThemes.reserved.border, legendThemes.reserved.text)}>
                            Reserved {statusCounts.reserved}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-md border", legendThemes.hold.bg, legendThemes.hold.border, legendThemes.hold.text)}>
                            Holds {statusCounts.hold}
                        </Badge>
                        <Badge variant="outline" className={cn("rounded-md border", legendThemes.out_of_service.bg, legendThemes.out_of_service.border, legendThemes.out_of_service.text)}>
                            Out of service {statusCounts.out_of_service}
                        </Badge>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
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
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base">Controls</CardTitle>
                                <CardDescription>Pick a zone, date, and time.</CardDescription>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-[180px] justify-start text-left text-sm font-normal",
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
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zones</p>
                                <ToggleGroup
                                    type="single"
                                    value={selectedZoneId}
                                    onValueChange={(value) => {
                                        if (value) setSelectedZoneId(value);
                                    }}
                                    className="flex flex-wrap justify-start gap-2"
                                    aria-label="Zone filter"
                                >
                                    <ToggleGroupItem value="all" className="h-12 px-3 text-xs sm:h-9">
                                        All zones
                                    </ToggleGroupItem>
                                    {zones.map(zone => (
                                        <ToggleGroupItem key={zone.id} value={zone.id} className="h-12 px-3 text-xs sm:h-9">
                                            {zone.name}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="font-semibold uppercase tracking-wide">Time</span>
                                    <Badge variant="outline" className="rounded-md">
                                        {timeString}
                                    </Badge>
                                </div>
                                <input
                                    type="range"
                                    min={timelineConfig.min}
                                    max={timelineConfig.max}
                                    step={timelineConfig.interval}
                                    value={currentTimeVal}
                                    onChange={(e) => setCurrentTimeVal(parseFloat(e.target.value))}
                                    className="w-full accent-foreground"
                                    aria-label="Select time"
                                />
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                    <span>{formatMinutesLabel(timelineConfig.min)}</span>
                                    <span>{formatMinutesLabel(timelineConfig.max)}</span>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legend</span>
                                <Badge variant="outline" className={cn("rounded-md border", legendThemes.available.bg, legendThemes.available.border, legendThemes.available.text)}>
                                    Available
                                </Badge>
                                <Badge variant="outline" className={cn("rounded-md border", legendThemes.reserved.bg, legendThemes.reserved.border, legendThemes.reserved.text)}>
                                    Reserved
                                </Badge>
                                <Badge variant="outline" className={cn("rounded-md border", legendThemes.hold.bg, legendThemes.hold.border, legendThemes.hold.text)}>
                                    Hold
                                </Badge>
                                <Badge variant="outline" className={cn("rounded-md border", legendThemes.out_of_service.bg, legendThemes.out_of_service.border, legendThemes.out_of_service.text)}>
                                    Out of service
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

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
                                    "relative flex h-[60vh] min-h-[420px] w-full items-center justify-center overflow-hidden bg-muted/30 touch-none",
                                    isDragging ? "cursor-grabbing" : "cursor-grab"
                                )}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                role="region"
                                aria-label="Floor plan canvas"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(15,23,42,0.12)_1px,_transparent_1px)] [background-size:18px_18px] opacity-40" />

                                <div
                                    className="relative h-full w-full max-w-5xl aspect-[4/3] rounded-3xl border border-border/60 bg-background/70 shadow-lg ring-1 ring-border/30 backdrop-blur-sm transition-transform duration-75 ease-out"
                                    style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                                >
                                    <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ zIndex: 5 }}>
                                        {Array.from(mergedGroups.entries()).map(([bookingId, groupTables]) => {
                                            const lines = [];
                                            const theme = legendThemes.reserved;

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

                                    {tablesWithStatus.map((table) => {
                                        const status = table.currentStatus;
                                        const isSelected = selectedTableId === table.id;
                                        const theme = getStatusTheme(status.state);

                                        const booking = status.booking;
                                        const isMerged = booking && booking.tableIds && booking.tableIds.length > 1;
                                        const mergedTableCount = isMerged && booking?.tableIds ? booking.tableIds.length : 0;

                                        const isRound = table.mobility === 'fixed';
                                        const capacity = table.capacity || 2;

                                        let widthPercent = 5;
                                        let aspectRatio = '1/1';

                                        if (isRound) {
                                            if (capacity <= 2) widthPercent = 4;
                                            else if (capacity <= 4) widthPercent = 5.5;
                                            else if (capacity <= 6) widthPercent = 7;
                                            else widthPercent = 8.5;
                                            aspectRatio = '1/1';
                                        } else {
                                            if (capacity <= 2) {
                                                widthPercent = 4;
                                                aspectRatio = '1/1';
                                            } else if (capacity <= 4) {
                                                widthPercent = 6;
                                                aspectRatio = '1.4/1';
                                            } else if (capacity <= 6) {
                                                widthPercent = 8;
                                                aspectRatio = '1.8/1';
                                            } else {
                                                widthPercent = 10;
                                                aspectRatio = '2.2/1';
                                            }
                                        }

                                        const minTapSize = Math.round(44 / Math.max(zoom, 0.5));

                                        return (
                                            <button
                                                key={table.id}
                                                onClick={() => handleTableClick(table.id)}
                                                className={cn(
                                                    "absolute group z-10 flex items-center justify-center transition-transform duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                                    isSelected ? "z-20 scale-110" : "hover:scale-105"
                                                )}
                                                style={{
                                                    left: `${table.xPercent}%`,
                                                    top: `${table.yPercent}%`,
                                                    width: `${widthPercent}%`,
                                                    minWidth: `${minTapSize}px`,
                                                    minHeight: `${minTapSize}px`,
                                                    aspectRatio: aspectRatio,
                                                    transform: `rotate(${table.rotation}deg)`
                                                }}
                                                aria-pressed={isSelected}
                                                aria-label={`Table ${table.tableNumber}, ${status.state.replace('_', ' ')}`}
                                            >
                                                <div className={cn(
                                                    "absolute inset-0 border-2 shadow-sm transition-colors",
                                                    isRound ? "rounded-full" : "rounded-lg",
                                                    theme.bg,
                                                    theme.border,
                                                    isMerged && "ring-2 ring-offset-1 ring-current/30"
                                                )}>
                                                    <div className={cn(
                                                        "absolute inset-2 opacity-20 rounded-full",
                                                        theme.fill
                                                    )} />

                                                    <div className={cn(
                                                        "absolute inset-0 flex flex-col items-center justify-center",
                                                        theme.text
                                                    )}>
                                                        <span className="text-[8px] sm:text-[10px] font-semibold leading-none">{table.tableNumber}</span>
                                                        {status.state === 'reserved' && !isMerged ? (
                                                            <div className={cn("mt-0.5 h-1 w-1 rounded-full", theme.fill)} />
                                                        ) : null}
                                                        {isMerged ? (
                                                            <div className="mt-0.5 rounded-full bg-white/60 px-1 text-[7px] font-semibold">
                                                                {mergedTableCount}x
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    {isMerged ? (
                                                        <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[6px] font-bold text-muted-foreground shadow-sm">
                                                            +
                                                        </div>
                                                    ) : null}
                                                </div>

                                                {isRound ? (
                                                    Array.from({ length: Math.min(capacity, 8) }).map((_, i) => {
                                                        const count = Math.min(capacity, 8);
                                                        const angle = (i * 360) / count;
                                                        return (
                                                            <div
                                                                key={i}
                                                                className={cn(
                                                                    "absolute h-1/3 w-1/3 rounded-full border shadow-sm transition-colors",
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
                                                    <>
                                                        <div className="absolute -top-1/2 left-0 flex h-1/2 w-full items-end justify-around px-[10%] pointer-events-none">
                                                            {Array.from({ length: Math.ceil(capacity / 2) }).map((_, i) => (
                                                                <div
                                                                    key={`top-${i}`}
                                                                    className={cn(
                                                                        "mx-0.5 h-2/3 w-1/2 max-w-[30%] rounded-t-md border shadow-sm",
                                                                        theme.chair
                                                                    )}
                                                                />
                                                            ))}
                                                        </div>
                                                        <div className="absolute -bottom-1/2 left-0 flex h-1/2 w-full items-start justify-around px-[10%] pointer-events-none">
                                                            {Array.from({ length: Math.floor(capacity / 2) }).map((_, i) => (
                                                                <div
                                                                    key={`bottom-${i}`}
                                                                    className={cn(
                                                                        "mx-0.5 h-2/3 w-1/2 max-w-[30%] rounded-b-md border shadow-sm",
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

                                <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-xl border border-border/60 bg-background/80 p-1 shadow-sm no-drag">
                                    <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 rounded-lg">
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Zoom in</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 rounded-lg">
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Zoom out</TooltipContent>
                                        </Tooltip>
                                        <Separator />
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={handleReset} className="h-8 w-8 rounded-lg">
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Reset view</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <aside className="hidden lg:block">
                    <Card className="flex h-full min-h-[640px] flex-col">{inspectorContent}</Card>
                </aside>
            </div>

            {!isDesktop ? (
                <Sheet
                    open={Boolean(selectedTableData)}
                    onOpenChange={(open) => {
                        if (!open) setSelectedTableId(null);
                    }}
                >
                    <SheetContent side="bottom" className="h-[85vh] p-0">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Table details</SheetTitle>
                            <SheetDescription>Review table status and upcoming bookings.</SheetDescription>
                        </SheetHeader>
                        {inspectorContent}
                    </SheetContent>
                </Sheet>
            ) : null}
        </div>
    );
}
