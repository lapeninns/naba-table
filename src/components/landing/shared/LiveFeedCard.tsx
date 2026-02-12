'use client';

import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
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
    <div className="factory-card rounded-xl p-6 h-full flex flex-col bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="animate-pulse relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Automated Bookings
          </span>
        </div>
        <Badge
          variant="secondary"
          className="bg-blue-50 text-blue-700 ring-1 ring-blue-700/10 hover:bg-blue-100 transition-colors"
        >
          Active
        </Badge>
      </div>
      <div className="space-y-3 flex-1">
        {items.map((item, index) => (
          <div
            key={`${item.venue}-${item.time}-${index}`}
            className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 font-mono text-xs"
          >
            <div>
              <div className="font-semibold text-slate-900">{item.venue}</div>
              <div className="text-slate-500 mt-0.5">
                {item.time} • {item.party}
              </div>
            </div>
            <div
              className={cn(
                'font-medium',
                LIVE_FEED_SUCCESS_STATUSES.includes(item.status)
                  ? 'text-green-600'
                  : 'text-amber-600',
              )}
            >
              {item.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
