'use client';

import { AlertCircle, ChevronRight } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { DiscoveryIssue } from './discoveryValidation';

type DiscoveryFormContextValue = {
  markTouched: (fieldId: string) => void;
  setDisclosureOpen: (id: string, open: boolean) => void;
  /** Focuses an element after the next render, e.g. a row just added. */
  requestFocus: (elementId: string) => void;
  /** Opens every disclosure around the first issue and moves focus to its field. */
  showIssue: (issue: DiscoveryIssue) => void;
};

type DiscoveryFormState = {
  issueByField: ReadonlyMap<string, string>;
  showAllIssues: boolean;
  touched: ReadonlySet<string>;
  openDisclosures: ReadonlySet<string>;
};

/**
 * Issues, touched fields and open disclosures live in a small store rather than in the context
 * value, so the context value never changes. Each field and disclosure subscribes to its own
 * slice: an edit in one panel re-renders only the fields whose issue actually changed.
 */
type DiscoveryFormStore = {
  getState: () => DiscoveryFormState;
  update: (updater: (current: DiscoveryFormState) => DiscoveryFormState) => void;
  subscribe: (listener: () => void) => () => void;
};

function createDiscoveryFormStore(initial: DiscoveryFormState): DiscoveryFormStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    update: (updater) => {
      const next = updater(state);
      if (next === state) {
        return;
      }
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type DiscoveryFormContextInternal = DiscoveryFormContextValue & { store: DiscoveryFormStore };

const DiscoveryFormContext = createContext<DiscoveryFormContextInternal | null>(null);

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function buildIssueByField(issues: readonly DiscoveryIssue[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const issue of issues) {
    if (!map.has(issue.fieldId)) {
      map.set(issue.fieldId, issue.message);
    }
  }
  return map;
}

function toggleInSet(current: ReadonlySet<string>, id: string, present: boolean) {
  if (current.has(id) === present) {
    return current;
  }
  const next = new Set(current);
  if (present) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
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
  const issueByField = useMemo(() => buildIssueByField(issues), [issues]);
  const [store] = useState(() =>
    createDiscoveryFormStore({
      issueByField,
      showAllIssues,
      touched: new Set(),
      openDisclosures: new Set(),
    }),
  );
  const [pendingFocus, setPendingFocus] = useState<{ id: string; scroll: boolean } | null>(null);

  // Publishes new issues to subscribed fields before paint.
  useLayoutEffect(() => {
    store.update((current) =>
      current.issueByField === issueByField && current.showAllIssues === showAllIssues
        ? current
        : { ...current, issueByField, showAllIssues },
    );
  }, [issueByField, showAllIssues, store]);

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

  const value = useMemo<DiscoveryFormContextInternal>(
    () => ({
      store,
      markTouched: (fieldId) =>
        store.update((current) => {
          const touched = toggleInSet(current.touched, fieldId, true);
          return touched === current.touched ? current : { ...current, touched };
        }),
      setDisclosureOpen: (id, open) =>
        store.update((current) => {
          const openDisclosures = toggleInSet(current.openDisclosures, id, open);
          return openDisclosures === current.openDisclosures
            ? current
            : { ...current, openDisclosures };
        }),
      requestFocus: (elementId) => setPendingFocus({ id: elementId, scroll: false }),
      showIssue: (issue) => {
        store.update((current) => ({
          ...current,
          openDisclosures: new Set([...current.openDisclosures, ...issue.disclosures]),
        }));
        setPendingFocus({ id: issue.fieldId, scroll: true });
      },
    }),
    [store],
  );

  return <DiscoveryFormContext.Provider value={value}>{children}</DiscoveryFormContext.Provider>;
}

function useDiscoveryFormInternal(): DiscoveryFormContextInternal {
  const context = useContext(DiscoveryFormContext);
  if (!context) {
    throw new Error('useDiscoveryForm must be used inside DiscoveryFormProvider');
  }
  return context;
}

/** Stable form actions. Reading them never re-renders the caller when issues change. */
export function useDiscoveryForm(): DiscoveryFormContextValue {
  return useDiscoveryFormInternal();
}

function useDiscoveryFormSelector<T>(select: (state: DiscoveryFormState) => T): T {
  const { store } = useDiscoveryFormInternal();
  const getSnapshot = () => select(store.getState());
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** The issue shown for a field: after a save attempt, or once staff have left the field. */
export function useDiscoveryFieldIssue(fieldId: string | null): string | null {
  return useDiscoveryFormSelector((state) =>
    fieldId !== null && (state.showAllIssues || state.touched.has(fieldId))
      ? (state.issueByField.get(fieldId) ?? null)
      : null,
  );
}

export function useDiscoveryDisclosureOpen(id: string): boolean {
  return useDiscoveryFormSelector((state) => state.openDisclosures.has(id));
}

export function discoveryFieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

/**
 * Error wiring for one field: `aria-invalid`, `aria-describedby` and the blur that reveals the
 * field's issue. Spread `fieldProps` onto the input.
 */
export function useDiscoveryField(fieldId: string, describedBy?: string) {
  const { markTouched } = useDiscoveryForm();
  const issue = useDiscoveryFieldIssue(fieldId);
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
  const { setDisclosureOpen } = useDiscoveryForm();
  const open = useDiscoveryDisclosureOpen(id);

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
