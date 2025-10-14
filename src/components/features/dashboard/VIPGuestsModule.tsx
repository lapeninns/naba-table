'use client';

import { Award, Mail, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type VIPGuest = {
  bookingId: string;
  customerId: string;
  customerName: string;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalPoints: number;
  startTime: string;
  partySize: number;
  marketingOptIn: boolean;
};

type VIPGuestsModuleProps = {
  vips: VIPGuest[];
  loading?: boolean;
  totalVipCovers?: number;
};

const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500 text-white border-purple-500',
  gold: 'bg-yellow-500 text-black border-yellow-500',
  silver: 'bg-gray-400 text-white border-gray-400',
  bronze: 'bg-amber-700 text-white border-amber-700',
};

const TIER_ICONS: Record<string, string> = {
  platinum: '💎',
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
};

function formatTime(timeStr: string): string {
  if (!timeStr) return '--:--';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeStr;
  const hours = parseInt(match[1]!, 10);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export function VIPGuestsModule({ vips, loading, totalVipCovers }: VIPGuestsModuleProps) {
  if (loading) {
    return <VIPGuestsModuleSkeleton />;
  }

  if (vips.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Award className="h-5 w-5 text-yellow-500" aria-hidden />
          Today's VIP Arrivals
        </h3>
        {totalVipCovers && totalVipCovers > 0 ? (
          <span className="text-sm font-normal text-muted-foreground">{totalVipCovers} covers</span>
        ) : null}
      </div>
      <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
        {vips.map((vip) => (
          <VIPCard key={vip.bookingId} vip={vip} />
        ))}
      </div>
    </div>
  );
}

function VIPCard({ vip }: { vip: VIPGuest }) {
  const tierColor = TIER_COLORS[vip.loyaltyTier] ?? TIER_COLORS.bronze;
  const tierIcon = TIER_ICONS[vip.loyaltyTier] ?? '🏅';

  return (
    <div className="rounded-xl border border-border/10 bg-background p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xl" aria-hidden>
            {tierIcon}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{vip.customerName}</h4>
              <Badge variant="outline" className={cn('text-xs font-semibold', tierColor)}>
                {vip.loyaltyTier}
              </Badge>
              {vip.marketingOptIn ? (
                <span className="inline-flex items-center">
                  <Mail className="h-3 w-3 text-green-600" aria-hidden />
                  <span className="sr-only">Marketing opt-in</span>
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatTime(vip.startTime)}</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" aria-hidden />
                {vip.partySize}
              </span>
              <span className="text-muted-foreground">{vip.totalPoints} pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VIPGuestsModuleSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/10 bg-background p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
