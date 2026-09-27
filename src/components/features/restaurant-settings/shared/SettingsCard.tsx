import { useId, type HTMLAttributes, type ReactNode } from 'react';

import { Card, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  SETTINGS_CARD_CLASS,
  SETTINGS_CARD_CONTENT_CLASS,
  SETTINGS_CARD_DESCRIPTION_CLASS,
  SETTINGS_CARD_HEADER_CLASS,
  SETTINGS_CARD_TITLE_CLASS,
  SETTINGS_COMPACT_CARD_FOOTER_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
} from './compactSettingsClasses';

export type SettingsCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> & {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Right-aligned header control, e.g. an outline "Add" button. */
  headerAction?: ReactNode;
  /** Inline markers after the title: audience, "Edited", issue counts. */
  badges?: ReactNode;
  /** Full-width strip between the header and the content, e.g. a sync status line. */
  subheader?: ReactNode;
  /** Heading level of the title. Defaults to `h2`. */
  titleAs?: 'h2' | 'h3';
  /** Id of the title element. Generated when omitted. */
  titleId?: string;
  /** Exposes the card as a landmark region labelled by its title. */
  region?: boolean;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  stickyFooter?: boolean;
};

/**
 * The one titled section container for restaurant settings: a white header with an h2 title,
 * a text-sm description, optional inline badges and a right-aligned action, then padded content.
 * Extra root props (`id`, `data-*`, `aria-*`) pass through to the card.
 */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
  headerAction,
  badges,
  subheader,
  titleAs: TitleTag = 'h2',
  titleId,
  region = false,
  contentClassName,
  headerClassName,
  footerClassName,
  stickyFooter = false,
  ...rootProps
}: SettingsCardProps) {
  const generatedTitleId = useId();
  const resolvedTitleId = titleId ?? `settings-card-title-${generatedTitleId.replace(/:/g, '')}`;

  return (
    <Card
      variant="compact"
      {...rootProps}
      role={region ? 'region' : rootProps.role}
      aria-labelledby={region ? resolvedTitleId : rootProps['aria-labelledby']}
      data-slot="settings-card"
      className={cn(SETTINGS_CARD_CLASS, rootProps.id && 'scroll-mt-28', className)}
    >
      <header
        data-slot="settings-card-header"
        className={cn(SETTINGS_CARD_HEADER_CLASS, headerClassName)}
      >
        {/* The action stays in the header row, end-aligned. Only when the title column would drop
            under 10rem does it wrap below, still end-aligned (RR5). */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <TitleTag id={resolvedTitleId} className={SETTINGS_CARD_TITLE_CLASS}>
                {title}
              </TitleTag>
              {badges}
            </div>
            {description ? (
              <div
                data-slot="settings-card-description"
                className={SETTINGS_CARD_DESCRIPTION_CLASS}
              >
                {description}
              </div>
            ) : null}
          </div>
          {headerAction ? (
            <div
              data-slot="settings-card-header-action"
              className="ms-auto flex max-w-full shrink-0 items-center gap-2"
            >
              {headerAction}
            </div>
          ) : null}
        </div>
      </header>
      {subheader}
      <div
        data-slot="settings-card-content"
        className={cn(SETTINGS_CARD_CONTENT_CLASS, contentClassName)}
      >
        {children}
      </div>
      {footer ? (
        <CardFooter
          className={cn(
            stickyFooter
              ? SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS
              : SETTINGS_COMPACT_CARD_FOOTER_CLASS,
            footerClassName,
          )}
        >
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
