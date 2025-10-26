"use client";
import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  onSubmitSearch?: (value: string) => void;
};

export default function SearchBar({ className, onSubmitSearch, placeholder = "Start your search", ...props }: Props) {
  const [value, setValue] = React.useState("");
  return (
    <form
      role="search"
      aria-label="Search experiences"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmitSearch?.(value);
      }}
      className={cn("w-full", className)}
    >
      <div
        className={cn(
          "search-bar flex items-center gap-3 px-4",
          "h-[52px] rounded-[var(--radius-full)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]",
          "focus-within:ring-2 focus-within:ring-[color:var(--color-primary)]",
        )}
      >
        <Search aria-hidden className="h-5 w-5 text-[color:var(--color-text-secondary)]" />
        <input
          className={cn(
            "w-full bg-transparent outline-none",
            "text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-secondary)]",
            "text-[16px] leading-[24px]",
          )}
          placeholder={placeholder}
          aria-label="Search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          {...props}
        />
      </div>
    </form>
  );
}

