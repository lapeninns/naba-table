import { cn } from "@/lib/utils"

import type { ComponentProps } from "react"


type SkeletonProps = ComponentProps<"div">

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
