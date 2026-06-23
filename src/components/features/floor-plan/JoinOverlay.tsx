'use client';

import type { ProjectedBox, ProjectedLink } from './domain/project';

export type JoinOverlayProps = {
  links: ProjectedLink[];
  boxes: ProjectedBox[];
  /** Dashed "could-join" hints from the selected table to its combine candidates. */
  hints?: ProjectedLink[];
};

/** SVG join lines + bracket boxes drawn over joined (merged) parties, in pixel space. */
export function JoinOverlay({ links, boxes, hints = [] }: JoinOverlayProps) {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-primary"
        aria-hidden
      >
        {hints.map((hint) => (
          <g key={hint.key}>
            <line
              x1={hint.x1}
              y1={hint.y1}
              x2={hint.x2}
              y2={hint.y2}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray="4 4"
              opacity={0.5}
            />
            <circle
              cx={(hint.x1 + hint.x2) / 2}
              cy={(hint.y1 + hint.y2) / 2}
              r={4}
              fill="hsl(var(--card))"
              stroke="currentColor"
              strokeWidth={1.5}
              opacity={0.9}
            />
          </g>
        ))}
        {links.map((link) => (
          <line
            key={link.key}
            x1={link.x1}
            y1={link.y1}
            x2={link.x2}
            y2={link.y2}
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
      </svg>
      {boxes.map((box) => (
        <div
          key={box.key}
          aria-hidden
          className="pointer-events-none absolute box-border rounded-2xl border-2 border-primary/60 bg-primary/5"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        >
          <span className="absolute -top-2.5 left-3 whitespace-nowrap rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {box.label}
          </span>
        </div>
      ))}
    </>
  );
}
