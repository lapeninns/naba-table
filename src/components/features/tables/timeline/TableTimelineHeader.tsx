import { format, parseISO } from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutDashboard,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { formatTime, type TimelineService } from './tableTimelineDomain';

import type { TableTimelineResponse } from '@/types/ops';

export function TableTimelineHeader({
  search,
  selectedDate,
  selectedZoneName,
  service,
  timelineWindow,
  onSearchChange,
  onSelectedDateChange,
}: {
  readonly search: string;
  readonly selectedDate: string | null;
  readonly selectedZoneName: string | null;
  readonly service: TimelineService;
  readonly timelineWindow: TableTimelineResponse['window'] | null | undefined;
  readonly onSearchChange: (value: string) => void;
  readonly onSelectedDateChange: (value: string | null) => void;
}) {
  const displayDate = selectedDate ? parseISO(selectedDate) : null;

  return (
    <nav className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary p-2 text-primary-foreground shadow-sm">
            <LayoutDashboard className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-lg font-semibold text-foreground">Capacity Timeline</h1>
            <p className="text-xs text-muted-foreground">
              {service === 'all' ? 'All services' : service === 'lunch' ? 'Lunch' : 'Dinner'}
              {selectedZoneName ? ` • ${selectedZoneName}` : ''}
              {timelineWindow?.start && timelineWindow?.end
                ? ` • ${formatTime(timelineWindow.start)}–${formatTime(timelineWindow.end)}`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Find table"
              placeholder="Find table…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-10 w-full pl-9 sm:w-72"
            />
          </div>

          <Button variant="outline" size="icon" aria-label="Filters" className="size-10" disabled>
            <Filter data-icon="icon" />
          </Button>

          <Separator orientation="vertical" className="hidden h-8 sm:block" />

          <div className="flex items-center rounded-lg bg-muted p-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous day"
              className="size-8"
              disabled
            >
              <ChevronLeft data-icon="icon" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'h-8 px-2 text-xs font-semibold',
                    !displayDate && 'text-muted-foreground',
                  )}
                  aria-label="Select date"
                >
                  <CalendarIcon data-icon="inline-start" />
                  {displayDate ? format(displayDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="end">
                <Calendar
                  mode="single"
                  selected={displayDate ?? undefined}
                  onSelect={(date) =>
                    onSelectedDateChange(date ? format(date, 'yyyy-MM-dd') : null)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" aria-label="Next day" className="size-8" disabled>
              <ChevronRight data-icon="icon" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
