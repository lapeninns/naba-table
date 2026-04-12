'use client';

import { CalendarIcon, MapPinIcon, PrinterIcon, MoreHorizontalIcon } from 'lucide-react';
import React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@shared/ui/button';

interface BookingConfirmationActionsProps {
  restaurantName: string;
  restaurantAddress?: string;
  date: Date;
  partySize: number;
  bookingRef: string;
  onDownloadIcs?: () => void;
}

export function BookingConfirmationActions({
  restaurantName,
  restaurantAddress,
  date,
  partySize,
  bookingRef,
  onDownloadIcs,
}: BookingConfirmationActionsProps) {
  // Calculate end time (assume 2 hours duration)
  const endTime = new Date(date.getTime() + 2 * 60 * 60 * 1000);

  const eventDetails = {
    title: `Dinner at ${restaurantName}`,
    description: `Reservation Reference: ${bookingRef}\nParty Size: ${partySize}`,
    location: restaurantAddress || restaurantName,
    start: date,
    end: endTime,
  };

  const getGoogleCalendarUrl = () => {
    const formatTime = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: eventDetails.title,
      dates: `${formatTime(eventDetails.start)}/${formatTime(eventDetails.end)}`,
      details: eventDetails.description,
      location: eventDetails.location,
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGetDirections = () => {
    const query = encodeURIComponent(restaurantAddress || restaurantName);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="luminous-card grid gap-3 rounded-[var(--luminous-radius)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="space-y-1">
        <p className="luminous-kicker">Next steps</p>
        <p className="text-sm font-semibold text-foreground">Save or share your reservation</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="luminous-cta min-h-[46px] gap-2 rounded-[var(--luminous-radius)] px-4 text-white">
              <CalendarIcon className="h-4 w-4" />
              Add to calendar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Choose Calendar</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.open(getGoogleCalendarUrl(), '_blank')}>
              Google Calendar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadIcs}>
              Download .ICS File (Outlook/iCal)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const formatTime = (d: Date) => d.toISOString();
                const params = new URLSearchParams({
                  path: '/calendar/action/compose',
                  rru: 'addevent',
                  startdt: formatTime(eventDetails.start),
                  enddt: formatTime(eventDetails.end),
                  subject: eventDetails.title,
                  body: eventDetails.description,
                  location: eventDetails.location,
                });
                window.open(
                  `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`,
                  '_blank',
                );
              }}
            >
              Outlook Web
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="secondary"
          className="luminous-secondary min-h-[46px] gap-2 rounded-[var(--luminous-radius)] px-4"
          onClick={handleGetDirections}
        >
          <MapPinIcon className="h-4 w-4" />
          Directions
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="luminous-ghost h-[46px] w-[46px] shrink-0"
            >
              <MoreHorizontalIcon className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handlePrint} className="gap-2">
              <PrinterIcon className="h-4 w-4" />
              Print Confirmation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
