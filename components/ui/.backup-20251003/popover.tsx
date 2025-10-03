"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  contentRef: React.RefObject<HTMLDivElement>;
  contentId: string;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string): PopoverContextValue {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error(`${component} must be used within <Popover />`);
  }
  return context;
}

export interface PopoverProps {
  children: React.ReactNode;
  className?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Popover: React.FC<PopoverProps> = ({ children, className, open, defaultOpen = false, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const contentId = React.useId();

  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? Boolean(open) : internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  React.useEffect(() => {
    if (!resolvedOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleFocus(event: FocusEvent) {
      const target = event.target as Node;
      if (contentRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [resolvedOpen, setOpen]);

  const value = React.useMemo<PopoverContextValue>(
    () => ({ open: resolvedOpen, setOpen, triggerRef, contentRef, contentId }),
    [resolvedOpen, setOpen, triggerRef, contentRef, contentId],
  );

  return (
    <PopoverContext.Provider value={value}>
      <div className={cn("relative inline-flex w-full", className)}>{children}</div>
    </PopoverContext.Provider>
  );
};

function composeHandlers<E extends React.SyntheticEvent>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
) {
  return (event: E) => {
    theirs?.(event);
    if (event.defaultPrevented) return;
    ours(event);
  };
}

export interface PopoverTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

const PopoverTrigger = React.forwardRef<HTMLElement, PopoverTriggerProps & React.HTMLAttributes<HTMLElement>>(
  ({ asChild = false, children, ...props }, ref) => {
    const { open, setOpen, triggerRef, contentId } = usePopoverContext("PopoverTrigger");

    const toggle = React.useCallback(() => {
      setOpen(!open);
    }, [open, setOpen]);

  if (asChild) {
    if (!React.isValidElement(children)) {
      throw new Error("PopoverTrigger with `asChild` expects a single React element child.");
    }

    const child = children as React.ReactElement<Record<string, any>> & {
      ref?: React.Ref<HTMLElement>;
    };

    return React.cloneElement(child, {
      ...props,
      ref: mergeRefs(child.ref as React.Ref<HTMLElement> | undefined, ref, triggerRef),
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "aria-controls": contentId,
      onClick: composeHandlers(child.props?.onClick, () => toggle()),
    });
  }

  return (
    <button
      type="button"
      ref={mergeRefs(ref, triggerRef)}
      {...props}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={contentId}
      onClick={composeHandlers(props.onClick as any, () => toggle())}
    >
      {children}
    </button>
  );
  },
);
PopoverTrigger.displayName = "PopoverTrigger";

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "center", style, children, ...props }, ref) => {
    const { open, contentRef, contentId } = usePopoverContext("PopoverContent");

    if (!open) return null;

    const alignmentClass =
      align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";

    return (
      <div
        ref={mergeRefs(ref, contentRef)}
        id={contentId}
        role="dialog"
        className={cn(
          "absolute z-50 mt-2 min-w-[12rem] rounded-lg border border-[color:var(--color-border)] bg-base-100 p-3 shadow-lg",
          alignmentClass,
          className,
        )}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  },
);
PopoverContent.displayName = "PopoverContent";

function mergeRefs<T>(...refs: (React.Ref<T> | undefined | React.RefObject<T>)[]) {
  return (value: T) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(value);
      } else {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

export { Popover, PopoverTrigger, PopoverContent };
