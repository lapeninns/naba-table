import { Clock3, ExternalLink, ImageIcon, MessageSquareQuote, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import type { RestaurantDirectoryEntry } from '@src/data/restaurant-directory';

function formatStatusLabel(status: string | null) {
  if (!status) {
    return null;
  }

  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function RestaurantGoogleBusinessProfileHighlights({
  restaurant,
}: {
  restaurant: RestaurantDirectoryEntry;
}) {
  const google = restaurant.googleBusinessProfile;

  if (!google) {
    return null;
  }

  const statusLabel = formatStatusLabel(google.openStatus);
  const reviewSnippet = google.reviewSnippets[0] ?? null;
  const mediaItems = google.media.slice(0, 3);
  const regularHours =
    google.regularHoursSummary.length > 0
      ? google.regularHoursSummary.slice(0, 4)
      : google.moreHoursSummary.slice(0, 4);
  const serviceSignals = google.serviceItems.slice(0, 4);

  return (
    <section className="space-y-4" aria-labelledby="restaurant-google-highlights-heading">
      <div>
        <p className="text-sm font-medium text-blue-700">Live from Google</p>
        <h3
          id="restaurant-google-highlights-heading"
          className="mt-1 text-xl font-semibold text-slate-900"
        >
          Fresh venue signals before you book
        </h3>
      </div>

      <Card className="space-y-4 rounded-[var(--guest-radius-xl)] border-slate-100 bg-white p-6 shadow-[var(--guest-shadow-sm)]">
        <div className="flex flex-wrap gap-2">
          {statusLabel ? (
            <Badge variant="secondary" className="rounded-full">
              {statusLabel}
            </Badge>
          ) : null}
          {google.primaryCategory ? (
            <Badge variant="secondary" className="rounded-full">
              {google.primaryCategory}
            </Badge>
          ) : null}
          {typeof google.rating === 'number' && typeof google.reviewCount === 'number' ? (
            <Badge variant="secondary" className="rounded-full">
              {google.rating.toFixed(1)} Google rating ({google.reviewCount} reviews)
            </Badge>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <GoogleFactCard
            icon={Clock3}
            title="Opening pattern"
            body={
              regularHours.length > 0
                ? regularHours.join(' | ')
                : 'Google has not returned regular hours for this venue yet.'
            }
          />
          <GoogleFactCard
            icon={Sparkles}
            title="Attributes and services"
            body={
              google.attributeLabels.length > 0
                ? google.attributeLabels.slice(0, 4).join(' · ')
                : serviceSignals.length > 0
                  ? serviceSignals.join(' · ')
                  : 'No Google attributes or service details are available yet.'
            }
          />
          <GoogleFactCard
            icon={Star}
            title="Links"
            body={
              google.mapsUri || google.reviewUri || google.websiteUri
                ? 'Open Maps, reviews, or the venue website directly from this page.'
                : 'No direct Google or website links are available yet.'
            }
          />
        </div>

        {reviewSnippet ? (
          <div className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <MessageSquareQuote className="h-4 w-4 text-blue-700" aria-hidden />
              Recent Google review
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600">“{reviewSnippet.comment}”</p>
            <p className="mt-2 text-xs text-slate-500">
              {reviewSnippet.reviewerDisplayName ?? 'Google reviewer'}
            </p>
          </div>
        ) : null}

        {mediaItems.length > 0 ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <ImageIcon className="h-4 w-4 text-blue-700" aria-hidden />
              Google media preview
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {mediaItems.map((item) => (
                <div
                  key={item.name}
                  className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 p-4"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {item.description ?? item.category ?? 'Google media'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[item.category, item.format].filter(Boolean).join(' · ') || 'Media item'}
                  </p>
                  {item.googleUrl ? (
                    <Link
                      href={item.googleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800"
                    >
                      Open media
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 text-sm">
          {google.mapsUri ? (
            <Link
              href={google.mapsUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800"
            >
              Open Google Maps
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          {google.reviewUri ? (
            <Link
              href={google.reviewUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800"
            >
              Open Google reviews
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          {google.websiteUri ? (
            <Link
              href={google.websiteUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800"
            >
              Visit venue website
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

function GoogleFactCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Clock3;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[var(--guest-radius-lg)] border border-slate-100 bg-slate-50 p-4">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
