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
    <div className="flex flex-wrap gap-3 rounded-[var(--pg-radius-md)] border border-border bg-muted/40 p-3">
      <Button
        variant="outline"
        className="pg-action flex-1 gap-2 rounded-full bg-background sm:flex-none"
        onClick={handleGetDirections}
      >
        <MapPinIcon className="size-4" />
        Directions
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="pg-action flex-1 gap-2 rounded-full bg-background sm:flex-none"
          >
            <CalendarIcon className="size-4" />
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
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint} className="gap-2">
            <PrinterIcon className="size-4" />
            Print Confirmation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
