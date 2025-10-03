"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Toggle, type ToggleProps } from "@/components/ui/toggle";

type ToggleGroupType = "single" | "multiple";

type ToggleGroupValue = string | string[] | undefined;

type ToggleGroupContextValue = {
  type: ToggleGroupType;
  value: ToggleGroupValue;
  setValue: (value: ToggleGroupValue) => void;
  variant: ToggleProps["variant"];
  size: ToggleProps["size"];
  disabled?: boolean;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null);

function useToggleGroup(component: string): ToggleGroupContextValue {
  const context = React.useContext(ToggleGroupContext);
  if (!context) {
    throw new Error(`${component} must be used within <ToggleGroup />`);
  }
  return context;
}

export interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type: ToggleGroupType;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[] | undefined) => void;
  disabled?: boolean;
  variant?: ToggleProps["variant"];
  size?: ToggleProps["size"];
}

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  (
    {
      type,
      value,
      defaultValue,
      onValueChange,
      disabled,
      variant = "default",
      size = "default",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const initialValue = React.useMemo<ToggleGroupValue>(() => {
      if (defaultValue !== undefined) return defaultValue;
      return type === "multiple" ? [] : undefined;
    }, [defaultValue, type]);

    const [internalValue, setInternalValue] = React.useState<ToggleGroupValue>(initialValue);

    React.useEffect(() => {
      if (!isControlled) return;
      if (type === "multiple" && value === undefined) {
        // keep controlled multi-select consistent
        setInternalValue([]);
      } else {
        setInternalValue(value);
      }
    }, [isControlled, value, type]);

    const resolvedValue = isControlled ? value : internalValue;

    const setValue = React.useCallback(
      (next: ToggleGroupValue) => {
        if (!isControlled) {
          setInternalValue(next);
        }
        onValueChange?.(next as string | string[] | undefined);
      },
      [isControlled, onValueChange],
    );

    const contextValue = React.useMemo<ToggleGroupContextValue>(
      () => ({ type, value: resolvedValue, setValue, variant, size, disabled }),
      [type, resolvedValue, setValue, variant, size, disabled],
    );

    return (
      <ToggleGroupContext.Provider value={contextValue}>
        <div
          ref={ref}
          role={type === "single" ? "radiogroup" : "group"}
          className={cn("flex items-center justify-center gap-1", className)}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    );
  },
);
ToggleGroup.displayName = "ToggleGroup";

export interface ToggleGroupItemProps extends Omit<ToggleProps, "pressed" | "defaultPressed" | "onPressedChange"> {
  value: string;
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ value, className, variant, size, disabled, children, ...props }, ref) => {
    const group = useToggleGroup("ToggleGroupItem");
    const isDisabled = disabled ?? group.disabled;
    const groupValue = group.value;

    const isSelected = React.useMemo(() => {
      if (group.type === "multiple" && Array.isArray(groupValue)) {
        return groupValue.includes(value);
      }
      return groupValue === value;
    }, [groupValue, group.type, value]);

    const handleChange = (next: boolean) => {
      if (isDisabled) return;

      if (group.type === "single") {
        if (!next) return; // keep one option selected
        if (groupValue === value) return;
        group.setValue(value);
        return;
      }

      if (!Array.isArray(groupValue)) {
        group.setValue([value]);
        return;
      }

      if (next) {
        group.setValue([...groupValue, value]);
      } else {
        group.setValue(groupValue.filter((item) => item !== value));
      }
    };

    return (
      <Toggle
        ref={ref}
        role={group.type === "single" ? "radio" : "checkbox"}
        aria-checked={isSelected}
        pressed={isSelected}
        onPressedChange={handleChange}
        disabled={isDisabled}
        variant={variant ?? group.variant}
        size={size ?? group.size}
        className={cn("whitespace-nowrap", className)}
        {...props}
      >
        {children}
      </Toggle>
    );
  },
);
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
