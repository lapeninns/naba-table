'use client';

import { AlertCircle, ChevronRight } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { DiscoveryIssue } from './discoveryValidation';

type DiscoveryFormContextValue = {
  /** The issue shown for a field: after a save attempt, or once staff have left the field. */
  getFieldIssue: (fieldId: string) => string | null;
  markTouched: (fieldId: string) => void;
  isDisclosureOpen: (id: string) => boolean;
  setDisclosureOpen: (id: string, open: boolean) => void;
  /** Focuses an element after the next render, e.g. a row just added. */
  requestFocus: (elementId: string) => void;
  /** Opens every disclosure around the first issue and moves focus to its field. */
  showIssue: (issue: DiscoveryIssue) => void;
};

const DiscoveryFormContext = createContext<DiscoveryFormContextValue | null>(null);

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function DiscoveryFormProvider({
  issues,
  showAllIssues,
  children,
}: {
  issues: readonly DiscoveryIssue[];
  showAllIssues: boolean;
  children: ReactNode;
}) {
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [openDisclosures, setOpenDisclosures] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingFocus, setPendingFocus] = useState<{ id: string; scroll: boolean } | null>(null);

  useEffect(() => {
    if (!pendingFocus) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(pendingFocus.id);
      if (element) {
        if (pendingFocus.scroll) {
          element.scrollIntoView({
            block: 'center',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          });
        }
        element.focus({ preventScroll: pendingFocus.scroll });
      }
      setPendingFocus(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocus]);

  const issueByField = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) {
      if (!map.has(issue.fieldId)) {
        map.set(issue.fieldId, issue.message);
      }
    }
    return map;
  }, [issues]);

  const getFieldIssue = useCallback(
    (fieldId: string) =>
      showAllIssues || touched.has(fieldId) ? (issueByField.get(fieldId) ?? null) : null,
    [issueByField, showAllIssues, touched],
  );
  const markTouched = useCallback((fieldId: string) => {
    setTouched((current) => (current.has(fieldId) ? current : new Set(current).add(fieldId)));
  }, []);
  const isDisclosureOpen = useCallback((id: string) => openDisclosures.has(id), [openDisclosures]);
  const setDisclosureOpen = useCallback((id: string, open: boolean) => {
    setOpenDisclosures((current) => {
      if (current.has(id) === open) {
        return current;
      }
      const next = new Set(current);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);
  const requestFocus = useCallback((elementId: string) => {
    setPendingFocus({ id: elementId, scroll: false });
  }, []);
  const showIssue = useCallback((issue: DiscoveryIssue) => {
    setOpenDisclosures((current) => new Set([...current, ...issue.disclosures]));
    setPendingFocus({ id: issue.fieldId, scroll: true });
  }, []);

  const value = useMemo(
    () => ({
      getFieldIssue,
      markTouched,
      isDisclosureOpen,
      setDisclosureOpen,
      requestFocus,
      showIssue,
    }),
    [getFieldIssue, isDisclosureOpen, markTouched, requestFocus, setDisclosureOpen, showIssue],
  );

  return <DiscoveryFormContext.Provider value={value}>{children}</DiscoveryFormContext.Provider>;
}

export function useDiscoveryForm(): DiscoveryFormContextValue {
  const context = useContext(DiscoveryFormContext);
  if (!context) {
    throw new Error('useDiscoveryForm must be used inside DiscoveryFormProvider');
  }
  return context;
}

export function discoveryFieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

/**
 * Error wiring for one field: `aria-invalid`, `aria-describedby` and the blur that reveals the
 * field's issue. Spread `fieldProps` onto the input.
 */
export function useDiscoveryField(fieldId: string, describedBy?: string) {
  const { getFieldIssue, markTouched } = useDiscoveryForm();
  const issue = getFieldIssue(fieldId);
  const describedByIds = [describedBy, issue ? discoveryFieldErrorId(fieldId) : null]
    .filter(Boolean)
    .join(' ');
  return {
    issue,
    fieldProps: {
      id: fieldId,
      'aria-invalid': issue ? true : undefined,
      'aria-describedby': describedByIds || undefined,
      onBlur: () => markTouched(fieldId),
    },
  };
}

export function DiscoveryFieldError({ fieldId, issue }: { fieldId: string; issue: string | null }) {
  if (!issue) {
    return null;
  }
  return (
    <p
      id={discoveryFieldErrorId(fieldId)}
      className="flex items-start gap-1.5 text-xs leading-5 text-destructive"
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{issue}</span>
    </p>
  );
}

/** A collapsed "Advanced" area. Open state lives in the page so "Show first issue" can open it. */
export function DiscoveryDisclosure({
  id,
  title,
  hint,
  children,
  className,
  contentClassName,
}: {
  id: string;
  title: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const { isDisclosureOpen, setDisclosureOpen } = useDiscoveryForm();
  const open = isDisclosureOpen(id);

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setDisclosureOpen(id, next)}
      className={cn('flex flex-col', className)}
      data-discovery-disclosure={id}
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="group h-auto min-h-9 w-fit max-w-full justify-start gap-1.5 whitespace-normal px-1 py-1 text-left font-medium [@media(pointer:coarse)]:min-h-11"
        >
          <ChevronRight
            className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
            aria-hidden
          />
          <span>{title}</span>
          {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className={cn('pt-2', contentClassName)}>{children}</CollapsibleContent>
    </Collapsible>
  );
}
