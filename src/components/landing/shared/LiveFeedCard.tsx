'use client';

import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { LOCAL_VENUES } from './localVenues';

type LiveFeedStatus = 'Confirmed' | 'Pending' | 'Arriving' | 'Seated';

interface LiveFeedItem {
  venue: string;
  time: string;
  party: string;
  status: LiveFeedStatus;
}

const LIVE_FEED_VISIBLE_COUNT = 3;
const LIVE_FEED_STATUSES: LiveFeedStatus[] = ['Confirmed', 'Pending', 'Arriving', 'Seated'];
const LIVE_FEED_SUCCESS_STATUSES: LiveFeedStatus[] = ['Confirmed', 'Arriving', 'Seated'];
const TIME_OPTIONS = ['18:15', '18:45', '19:00', '19:30', '20:00', '20:30', '21:00'];
const LIVE_FEED_PARTY_SIZES = ['2 guests', '3 guests', '4 guests', '5 guests', '6 guests'];
const INITIAL_SEED = 42;

const createSeededRandom = (seed: number) => {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
};

function createSeededLiveFeedItem(random: () => number): LiveFeedItem {
  return {
    venue: LOCAL_VENUES[Math.floor(random() * LOCAL_VENUES.length)],
    time: TIME_OPTIONS[Math.floor(random() * TIME_OPTIONS.length)],
    party: LIVE_FEED_PARTY_SIZES[Math.floor(random() * LIVE_FEED_PARTY_SIZES.length)],
    status: LIVE_FEED_STATUSES[Math.floor(random() * LIVE_FEED_STATUSES.length)],
  };
}

const INITIAL_ITEMS = (() => {
  const random = createSeededRandom(INITIAL_SEED);
  return Array.from({ length: LIVE_FEED_VISIBLE_COUNT }, () => createSeededLiveFeedItem(random));
})();

function createUpdatedLiveFeedItem(): LiveFeedItem {
  return {
    venue: LOCAL_VENUES[Math.floor(Math.random() * LOCAL_VENUES.length)],
    time: TIME_OPTIONS[Math.floor(Math.random() * TIME_OPTIONS.length)],
    party: LIVE_FEED_PARTY_SIZES[Math.floor(Math.random() * LIVE_FEED_PARTY_SIZES.length)],
    status: LIVE_FEED_STATUSES[Math.floor(Math.random() * LIVE_FEED_STATUSES.length)],
  };
}

interface LiveFeedCardProps {
  reduceMotion: boolean;
}

export function LiveFeedCard({ reduceMotion }: LiveFeedCardProps) {
  const [items, setItems] = useState<LiveFeedItem[]>(() => [...INITIAL_ITEMS]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const interval = window.setInterval(() => {
      setItems((prev) => [
        createUpdatedLiveFeedItem(),
        ...prev.slice(0, LIVE_FEED_VISIBLE_COUNT - 1),
      ]);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  return (
    <Card
      variant="compact"
      className="flex h-full flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 sm:p-5 md:p-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex size-2 animate-pulse rounded-full bg-primary" />
          </div>
          <span className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Automated bookings
          </span>
        </div>
        <Badge variant="secondary" className="shrink-0">
          Active
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2.5 p-4 pt-0 sm:gap-3 sm:p-5 sm:pt-0 md:p-6 md:pt-0">
        {items.map((item, index) => (
          <div
            key={`${item.venue}-${item.time}-${index}`}
            className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/50 p-3 font-mono text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-foreground">{item.venue}</div>
              <div className="mt-0.5 text-muted-foreground">
                {item.time} • {item.party}
              </div>
            </div>
            <div
              className={cn(
                'shrink-0 font-medium',
                LIVE_FEED_SUCCESS_STATUSES.includes(item.status) ? 'text-success' : 'text-warning',
              )}
            >
              {item.status}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
