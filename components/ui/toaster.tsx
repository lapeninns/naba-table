"use client"

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()
  const toastViewportLabelId = "toast-viewport-region-label"

  return (
    <ToastProvider>
      <span id={toastViewportLabelId} className="sr-only">
        Notification center
      </span>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="flex flex-col gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport aria-labelledby={toastViewportLabelId} />
    </ToastProvider>
  )
}
