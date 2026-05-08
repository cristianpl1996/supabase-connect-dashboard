import type React from "react";

import { cn } from "@/lib/utils";

interface ErrorDisabledContentProps {
  disabled: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ErrorDisabledContent({ disabled, className, children }: ErrorDisabledContentProps) {
  return (
    <fieldset
      disabled={disabled}
      aria-disabled={disabled}
      className={cn("m-0 min-w-0 border-0 p-0", disabled && "pointer-events-none opacity-60", className)}
    >
      {children}
    </fieldset>
  );
}
