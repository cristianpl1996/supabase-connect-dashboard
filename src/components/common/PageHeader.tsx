import type React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  icon: React.ElementType;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-1 sm:h-6 sm:w-6 md:h-7 md:w-7" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-base leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="w-full shrink-0 md:w-auto">{actions}</div>}
    </div>
  );
}
