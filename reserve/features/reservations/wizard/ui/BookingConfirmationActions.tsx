'use client';

import { CalendarIcon, MapPinIcon, PrinterIcon, MoreHorizontalIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BookingConfirmationActionsProps {
  restaurantName: string;
  restaurantAddress?: string;
  start: Date;
  end: Date;
  partySize: number;
  bookingRef: string;
  onDownloadIcs?: () => void;
}

export function BookingConfirmationActions({
  restaurantName,
  restaurantAddress,
  start,
  end,
  partySize,
  bookingRef,
  onDownloadIcs,
}: BookingConfirmationActionsProps) {
  const headingId = React.useId();
  const eventDetails = {
    title: `Dinner at ${restaurantName}`,
    description: `Reservation Reference: ${bookingRef}\nParty Size: ${partySize}`,
    location: restaurantAddress || restaurantName,
    start,
    end,
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
    <section
      aria-labelledby={headingId}
      className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
    >
      <h3 id={headingId} className="pg-kicker col-span-full mb-1">
        Booking actions
      </h3>
      <Button
        variant="outline"
        className="pg-action min-h-11 w-full gap-2 rounded-[var(--pg-radius-md)] bg-background"
        onClick={handleGetDirections}
      >
        <MapPinIcon className="size-4" aria-hidden />
        Directions
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="pg-action min-h-11 w-full gap-2 rounded-[var(--pg-radius-md)] bg-background"
          >
            <CalendarIcon className="size-4" aria-hidden />
            Add to Calendar
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
              // Outlook Web Link
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="min-h-11 w-full gap-2 rounded-[var(--pg-radius-md)] sm:size-11 sm:p-0"
          >
            <MoreHorizontalIcon className="size-4" aria-hidden />
            <span className="sm:sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint} className="gap-2">
            <PrinterIcon className="size-4" aria-hidden />
            Print Confirmation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  );
}
