import type React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  icon: React.ElementType;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  muted?: boolean;
};

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
  muted = false,
}: PageHeaderProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0 sm:mt-1 sm:size-6 md:size-7", muted ? "text-primary/40" : "text-primary")} />
        <div className="min-w-0">
          <h1 className={cn("text-xl font-bold leading-tight tracking-tight sm:text-2xl md:text-3xl", muted ? "text-muted-foreground" : "text-foreground")}>
            {title}
          </h1>
          <p className="mt-1 text-base leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="w-full shrink-0 md:w-auto">{actions}</div>}
    </div>
  );
}
