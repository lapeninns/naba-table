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
    <div className="flex flex-wrap gap-3">
      {/* Get Directions */}
      <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={handleGetDirections}>
        <MapPinIcon className="h-4 w-4" />
        Directions
      </Button>

      {/* Add to Calendar Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex-1 sm:flex-none gap-2">
            <CalendarIcon className="h-4 w-4" />
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

      {/* Print / More Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
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
  );
}
