import * as React from "react";
import {
  Controller,
  FormProvider,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@/lib/utils";

const Form = FormProvider;

type FormFieldContextValue<TFieldValues extends FieldValues = FieldValues> = {
  name: FieldPath<TFieldValues>;
};

const FormFieldContext = React.createContext<FormFieldContextValue | undefined>(undefined);

function useFormField() {
  const context = React.useContext(FormFieldContext);
  if (!context) {
    throw new Error("useFormField should be used within <FormField>");
  }
  return context;
}

type FormItemContextValue = {
  id: string;
  descriptionId: string;
  messageId: string;
};

const FormItemContext = React.createContext<FormItemContextValue | undefined>(undefined);

function useFormItemContext() {
  const context = React.useContext(FormItemContext);
  if (!context) {
    throw new Error("Form components must be used within <FormItem>");
  }
  return context;
}

const FormField = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  render,
}: ControllerProps<TFieldValues, TName>) => (
  <FormFieldContext.Provider value={{ name }}>
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState, formState }) =>
        render({
          field,
          fieldState,
          formState,
        })
      }
    />
  </FormFieldContext.Provider>
);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();
    const descriptionId = `${id}-description`;
    const messageId = `${id}-message`;

    return (
      <FormItemContext.Provider value={{ id, descriptionId, messageId }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    const { id } = useFormItemContext();
    const { name } = useFormField();

    return (
      <label
        ref={ref}
        htmlFor={props.htmlFor ?? id}
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium leading-none text-srx-ink-strong peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className,
        )}
        data-form-item-name={name}
        {...props}
      />
    );
  },
);
FormLabel.displayName = "FormLabel";

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

interface FormControlProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactElement;
}

const FormControl = React.forwardRef<HTMLElement, FormControlProps>(
  ({ children, className, ...props }, ref) => {
    const { id, descriptionId, messageId } = useFormItemContext();
    const child = React.Children.only(children) as React.ReactElement<Record<string, any>> & {
      ref?: React.Ref<HTMLElement>;
    };

    const describedBy = [descriptionId, messageId, child.props?.["aria-describedby"]]
      .filter(Boolean)
      .join(" ");

    return React.cloneElement(child, {
      id,
      "aria-describedby": describedBy || undefined,
      className: cn(child.props?.className, className),
      ref: mergeRefs(child.ref as React.Ref<HTMLElement> | undefined, ref),
      ...props,
    });
  },
);
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { descriptionId } = useFormItemContext();
    return (
      <p
        ref={ref}
        id={descriptionId}
        className={cn("text-sm text-base-content/70", className)}
        {...props}
      />
    );
  },
);
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { messageId } = useFormItemContext();
    if (!children) return null;
    return (
      <p
        ref={ref}
        id={messageId}
        className={cn("flex items-center gap-2 text-sm text-error", className)}
        role="alert"
        {...props}
      >
        {children}
      </p>
    );
  },
);
FormMessage.displayName = "FormMessage";

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
};
