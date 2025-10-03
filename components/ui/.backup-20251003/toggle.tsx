"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ToggleVariant = "default" | "outline";
type ToggleSize = "default" | "sm" | "lg";

const VARIANT_CLASSES: Record<ToggleVariant, string> = {
  default: "btn btn-ghost",
  outline: "btn btn-outline",
};

const SIZE_CLASSES: Record<ToggleSize, string> = {
  default: "",
  sm: "btn-sm",
  lg: "btn-lg",
};

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: ToggleVariant;
  size?: ToggleSize;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      className,
      pressed,
      defaultPressed = false,
      onPressedChange,
      variant = "default",
      size = "default",
      onClick,
      ...props
    },
    ref,
  ) => {
    const [internalPressed, setInternalPressed] = React.useState(defaultPressed);
    const isControlled = pressed !== undefined;
    const isPressed = isControlled ? Boolean(pressed) : internalPressed;

    const setPressed = React.useCallback(
      (next: boolean) => {
        if (!isControlled) {
          setInternalPressed(next);
        }
        onPressedChange?.(next);
      },
      [isControlled, onPressedChange],
    );

    return (
      <button
        type="button"
        ref={ref}
        className={cn(
          "btn inline-flex items-center justify-center gap-2 font-medium transition-colors",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          isPressed && "btn-active",
          className,
        )}
        aria-pressed={isPressed}
        data-state={isPressed ? "on" : "off"}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          setPressed(!isPressed);
        }}
        {...props}
      />
    );
  },
);
Toggle.displayName = "Toggle";

export { Toggle };
