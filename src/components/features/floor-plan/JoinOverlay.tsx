'use client';

import type { JoinBox, JoinLink } from './domain/joins';

export type JoinOverlayProps = {
  links: JoinLink[];
  boxes: JoinBox[];
};

/** SVG join lines + bracket boxes drawn over joined (merged) parties. */
export function JoinOverlay({ links, boxes }: JoinOverlayProps) {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        {links.map((link) => (
          <line
            key={link.key}
            x1={`${link.x1}%`}
            y1={`${link.y1}%`}
            x2={`${link.x2}%`}
            y2={`${link.y2}%`}
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
      </svg>
      {boxes.map((box) => (
        <div
          key={box.bookingId}
          aria-hidden
          className="pointer-events-none absolute rounded-2xl border-2 border-primary bg-primary/[0.06]"
          style={{
            left: `${box.left}%`,
            top: `${box.top}%`,
            width: `${box.width}%`,
            height: `${box.height}%`,
          }}
        >
          <span className="absolute -top-2.5 left-3 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
            Joined · {box.capacity} seats
          </span>
        </div>
      ))}
    </>
  );
}
