'use client';

import { Mail, Phone } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { TIER_COLORS, TIER_EMOJIS } from '../constants';
import { DetailCard } from './DetailCard';

import type { GuestProfilePanelProps } from '../types';

/**
 * Guest profile sidebar panel
 * Single Responsibility: Display guest information and preferences
 */
export function GuestProfilePanel({ booking }: GuestProfilePanelProps) {
  const mailHref = booking.customerEmail ? `mailto:${booking.customerEmail}` : null;
  const phoneHref = booking.customerPhone
    ? `tel:${booking.customerPhone.replace(/[^+\d]/g, '')}`
    : null;

  const initials = booking.customerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasPreferences =
    booking.allergies?.length ||
    booking.dietaryRestrictions?.length ||
    booking.seatingPreference;

  const hasNotes = booking.notes || booking.profileNotes;

  return (
    <div className="flex flex-col gap-6 border-r bg-muted/10 p-6 lg:col-span-4 overflow-y-auto">
      {/* Guest Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border-2 border-primary/30 text-2xl font-bold text-primary shadow-sm">
          {initials}
        </div>
        <div className="space-y-1.5">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {booking.customerName}
          </DialogTitle>
          {booking.loyaltyTier ? (
            <Badge
              variant="secondary"
              className={cn(
                'capitalize px-3 py-1.5 text-sm font-semibold shadow-sm',
                TIER_COLORS[booking.loyaltyTier],
                (booking.loyaltyTier === 'platinum' || booking.loyaltyTier === 'gold') &&
                  'bg-gradient-to-r'
              )}
            >
              {TIER_EMOJIS[booking.loyaltyTier] && `${TIER_EMOJIS[booking.loyaltyTier]} `}
              {booking.loyaltyTier}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground px-3 py-1">
              Guest
            </Badge>
          )}
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-3">
        <DetailCard
          icon={Mail}
          label="Email"
          value={booking.customerEmail ?? 'Not provided'}
          href={mailHref ?? undefined}
          actionLabel="Email"
          copyable={true}
          compact
        />
        <DetailCard
          icon={Phone}
          label="Phone"
          value={booking.customerPhone ?? 'Not provided'}
          href={phoneHref ?? undefined}
          actionLabel="Call"
          copyable={true}
          compact
        />
      </div>

      {/* Critical Tags (Allergies, Dietary, Seating) */}
      {hasPreferences ? (
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preferences
          </h4>
          <div className="flex flex-wrap gap-2">
            {booking.allergies?.map((allergy, idx) => (
              <Badge
                key={`alg-${idx}`}
                variant="destructive"
                className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200"
              >
                {allergy}
              </Badge>
            ))}
            {booking.dietaryRestrictions?.map((diet, idx) => (
              <Badge
                key={`diet-${idx}`}
                variant="secondary"
                className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200"
              >
                {diet}
              </Badge>
            ))}
            {booking.seatingPreference && (
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200"
              >
                {booking.seatingPreference}
              </Badge>
            )}
          </div>
        </div>
      ) : null}

      {/* Notes */}
      {hasNotes ? (
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Notes
          </h4>
          {booking.notes && (
            <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Booking Note
              </span>
              {booking.notes}
            </div>
          )}
          {booking.profileNotes && (
            <div className="rounded-lg border bg-yellow-50/50 p-3 text-sm shadow-sm">
              <span className="mb-1 block text-xs font-medium text-amber-700">
                Profile Note
              </span>
              {booking.profileNotes}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
