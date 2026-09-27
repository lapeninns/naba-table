import { Badge } from '@/components/ui/badge';

import type { SettingsStatusBadgeVariant } from '../../shared/SettingsStatusFacts';
import type { GbpTone } from '../gbpPageModel';

const TONE_VARIANT: Record<GbpTone, SettingsStatusBadgeVariant> = {
  ok: 'status-confirmed',
  off: 'status-completed',
  bad: 'status-cancelled',
};

/** The status Badge variant for a Google Business Profile tone. */
export function gbpToneBadgeVariant(tone: GbpTone): SettingsStatusBadgeVariant {
  return TONE_VARIANT[tone];
}

/**
 * Decorative status dot in the Badge's text colour. The label and value carry the meaning, so the
 * dot is never the only signal.
 */
export function GbpStatusDot() {
  return (
    <span
      aria-hidden
      data-slot="gbp-status-dot"
      className="size-1.5 shrink-0 rounded-full bg-current"
    />
  );
}

/**
 * "Connection" and "Linked" as two separate Badge children. A Badge is `inline-flex`, which drops a
 * trailing space in a bare text node, so the label and value must be their own items spaced by
 * the Badge's gap. The Badge must set a gap (`gap-1` or wider).
 */
export function GbpStatusLabel({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span>
      {/* Collapsed visually by the flex layout, but keeps "Connection Not connected" as two
          words for screen readers and copied text. */}{' '}
      <span className="font-semibold">{value}</span>
    </>
  );
}

/** "Connection · Linked": a status Badge whose variant follows the ops semantic tones. */
export function GbpStatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: GbpTone;
}) {
  return (
    <Badge variant={gbpToneBadgeVariant(tone)} className="gap-1.5" data-tone={tone}>
      <GbpStatusDot />
      <GbpStatusLabel label={label} value={value} />
    </Badge>
  );
}
