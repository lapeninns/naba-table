"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(component: string): DialogContextValue {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error(`${component} must be used within <Dialog />`);
  }
  return context;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, defaultOpen = false, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
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

  const value = React.useMemo<DialogContextValue>(
    () => ({ open: resolvedOpen, setOpen }),
    [resolvedOpen, setOpen],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

interface DialogTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

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

const DialogTrigger = React.forwardRef<HTMLElement, DialogTriggerProps & React.HTMLAttributes<HTMLElement>>(
  ({ asChild = false, children, ...props }, ref) => {
    const { setOpen } = useDialogContext("DialogTrigger");

    const handleClick = React.useCallback(() => {
      setOpen(true);
    }, [setOpen]);

    if (asChild) {
      if (!React.isValidElement(children)) {
        throw new Error("DialogTrigger with `asChild` expects a single React element child.");
      }

      const child = children as React.ReactElement<any> & { ref?: React.Ref<HTMLElement> };

      return React.cloneElement(child, {
        ...props,
        ref: mergeRefs(child.ref as React.Ref<HTMLElement> | undefined, ref),
        onClick: composeHandlers(child.props?.onClick as any, () => {
          handleClick();
        }),
      });
    }

    return (
      <button
        type="button"
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
        onClick={composeHandlers(props.onClick as any, () => handleClick())}
      >
        {children}
      </button>
    );
  },
);
DialogTrigger.displayName = "DialogTrigger";

const DialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
DialogPortal.displayName = "DialogPortal";

const DialogOverlay: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("modal-backdrop", className)} {...props} />
);
DialogOverlay.displayName = "DialogOverlay";

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onInteractOutside?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onInteractOutside, ...props }, ref) => {
    const { open, setOpen } = useDialogContext("DialogContent");

    React.useEffect(() => {
      if (!open) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
        }
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [open, setOpen]);

    const handleBackdropClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onInteractOutside?.(event);
      if (event.defaultPrevented) return;
      setOpen(false);
    };

    return (
      <dialog
        open={open}
        className={cn("modal", open && "modal-open")}
        aria-modal="true"
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div
          ref={ref}
          className={cn(
            "modal-box max-h-[90vh] overflow-y-auto space-y-4 bg-base-100 text-base-content",
            className,
          )}
          {...props}
        >
          {children}
        </div>
        <div className="modal-backdrop">
          <button type="button" aria-label="Close dialog" onClick={handleBackdropClick} />
        </div>
      </dialog>
    );
  },
);
DialogContent.displayName = "DialogContent";

const DialogClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { setOpen } = useDialogContext("DialogClose");
    const handleClick = composeHandlers(props.onClick, () => setOpen(false));

    return (
      <button
        type="button"
        ref={ref}
        className={className}
        {...props}
        onClick={handleClick}
      >
        {children}
      </button>
    );
  },
);
DialogClose.displayName = "DialogClose";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2 text-start", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-semibold text-base-content", className)} {...props} />
  ),
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-base-content/70", className)} {...props} />
  ),
);
DialogDescription.displayName = "DialogDescription";

function mergeRefs<T>(...refs: (React.Ref<T> | undefined | null)[]) {
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

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
