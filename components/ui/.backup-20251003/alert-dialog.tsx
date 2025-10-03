"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

const AlertDialogContext = React.createContext<React.Dispatch<React.SetStateAction<boolean>> | null>(null);

function useAlertDialogContext(component: string) {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error(`${component} must be used within <AlertDialog />`);
  }
  return context;
}

function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  return (
    <AlertDialogContext.Provider value={onOpenChange}>
      {open ? children : null}
    </AlertDialogContext.Provider>
  );
}

const AlertDialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
};

const AlertDialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm", className)}
      {...props}
    />
  ),
);
AlertDialogOverlay.displayName = "AlertDialogOverlay";

const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const onOpenChange = useAlertDialogContext("AlertDialogContent");
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement, []);

    React.useEffect(() => {
      if (!contentRef.current) return;
      const autoFocusTarget =
        contentRef.current.querySelector<HTMLElement>("[data-autofocus]") ??
        contentRef.current.querySelector<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
      autoFocusTarget?.focus({ preventScroll: true });
    }, []);

    return (
      <AlertDialogPortal>
        <AlertDialogOverlay onClick={() => onOpenChange(false)} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative w-full max-w-md rounded-2xl border border-srx-border-subtle bg-white text-srx-ink-strong shadow-srx-card",
              className,
            )}
            onClick={(event) => event.stopPropagation()}
            {...props}
          >
            {children}
          </div>
        </div>
      </AlertDialogPortal>
    );
  },
);
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 border-b border-srx-border-subtle px-6 py-5", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-lg font-semibold tracking-tight text-srx-ink-strong", className)}
      {...props}
    />
  ),
);
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("px-6 py-4 text-body-sm text-srx-ink-soft", className)}
      {...props}
    />
  ),
);
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-2 border-t border-srx-border-subtle bg-srx-surface-positive-alt/40 px-6 py-5 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, onClick, ...props }, ref) => {
  const onOpenChange = useAlertDialogContext("AlertDialogCancel");
  return (
    <Button
      ref={ref}
      variant="outline"
      className={cn("w-full sm:w-auto", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onOpenChange(false);
        }
      }}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = "AlertDialogCancel";

const AlertDialogAction = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, onClick, autoFocus, ...props }, ref) => {
  const onOpenChange = useAlertDialogContext("AlertDialogAction");
  return (
    <Button
      ref={ref}
      className={cn("w-full sm:w-auto", className)}
      autoFocus={autoFocus ?? true}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onOpenChange(false);
        }
      }}
      {...props}
    />
  );
});
AlertDialogAction.displayName = "AlertDialogAction";

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
};
