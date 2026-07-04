'use client';

import { Calendar, CalendarPlus, ReceiptText, Search } from 'lucide-react';

import {
  GuestContent,
  GuestEmpty,
  GuestError,
  GuestHero,
  GuestMetricCard,
  GuestPageFrame,
  GuestPanel,
  GuestPrimaryButton,
  GuestSectionHeader,
} from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type BookingsTab } from '@/guest/lib/validation';
import { StatusRegion } from '@/guest/routes/shared/StatusRegion';

import { BookingGrid, BookingsLoadingState } from './BookingListCards';
import { useBookingListController } from './useBookingListController';

export function BookingListClient({ initialTab = 'upcoming' }: { initialTab?: BookingsTab }) {
  const {
    activeTab,
    handleRetry,
    handleTabChange,
    hasAnyBookings,
    isLoading,
    isError,
    past,
    upcoming,
  } = useBookingListController({ initialTab });

  if (isLoading) return <BookingsLoadingState />;

  if (isError) {
    return (
      <StatusRegion focus live="assertive">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <GuestError
            description="We couldn't load your bookings. Please try again."
            onRetry={handleRetry}
          />
        </div>
      </StatusRegion>
    );
  }

  if (!hasAnyBookings) {
    return (
      <StatusRegion live="polite">
        <GuestPageFrame>
          <GuestHero
            eyebrow="My reservations"
            title="Your booking archive starts here."
            description="Once you reserve a table, upcoming plans, receipts, and manage links will appear in this portal."
            actions={<GuestPrimaryButton href="/restaurants">Find a restaurant</GuestPrimaryButton>}
            compact
          />
          <GuestContent narrow>
            <GuestEmpty
              icon={Search}
              title="No bookings yet"
              description="Browse live restaurants and book your first table."
              actionLabel="Find a restaurant"
              actionHref="/restaurants"
            />
          </GuestContent>
        </GuestPageFrame>
      </StatusRegion>
    );
  }

  return (
    <GuestPageFrame>
      <GuestHero
        eyebrow="My reservations"
        title="Upcoming plans and saved receipts."
        description="A clean archive for live reservations, past visits, receipt downloads, and repeat bookings."
        actions={
          <GuestPrimaryButton href="/restaurants">
            <CalendarPlus className="size-5" aria-hidden />
            New booking
          </GuestPrimaryButton>
        }
        aside={
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <GuestMetricCard icon={Calendar} label="Upcoming" value={upcoming.length} />
            <GuestMetricCard icon={ReceiptText} label="Receipts" value={past.length} />
          </div>
        }
        compact
      />

      <GuestContent>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <GuestSectionHeader
              eyebrow="Archive"
              title="Choose a view"
              description="Upcoming reservations stay operational. Past bookings focus on receipts and rebooking."
            />
            <TabsList className="grid h-auto grid-cols-2 rounded-[var(--pg-radius-pill)] border border-border/80 bg-background/90 p-1">
              <TabsTrigger value="upcoming" className="rounded-full px-4 py-2">
                Upcoming
                <Badge variant="secondary" className="ml-2 rounded-full">
                  {upcoming.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="past" className="rounded-full px-4 py-2">
                Past
                <Badge variant="secondary" className="ml-2 rounded-full">
                  {past.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="upcoming" className="mt-0">
            {upcoming.length === 0 ? (
              <GuestEmpty
                icon={Calendar}
                title="No upcoming reservations"
                description="Plan the next visit and it will appear here with manage and receipt links."
                actionLabel="Find a restaurant"
                actionHref="/restaurants"
              />
            ) : (
              <BookingGrid bookings={upcoming} />
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {past.length === 0 ? (
              <GuestPanel className="p-8 text-center">
                <ReceiptText className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden />
                <h3 className="pg-card-title">No receipts yet</h3>
                <p className="pg-caption mt-2">Completed reservations will appear here.</p>
              </GuestPanel>
            ) : (
              <BookingGrid bookings={past} isPast />
            )}
          </TabsContent>
        </Tabs>
      </GuestContent>
    </GuestPageFrame>
  );
}
