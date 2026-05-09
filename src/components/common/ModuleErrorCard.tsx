import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ModuleErrorCardProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
  title?: string;
  subtitle?: string;
  loading?: boolean;
}

export function ModuleErrorCard({
  message,
  onRetry,
  retryLabel = "Reintentar",
  title = "Revisa la conexion con la API y vuelve a intentarlo",
  loading = false,
}: ModuleErrorCardProps) {
  return (
    <Card className="overflow-hidden border-destructive/30 bg-card shadow-sm dark:border-red-500/30">
      <CardContent className="p-0">
        <div className="border-l-4 border-destructive bg-destructive/5 p-4 dark:border-red-500 dark:bg-red-500/10 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive dark:bg-red-500/10 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-base font-bold text-foreground">{title}</p>
                <p className="break-words text-sm font-medium text-destructive dark:text-red-300">{message}</p>
              </div>
            </div>
            <Button variant="outline" onClick={onRetry} disabled={loading} className="w-full gap-2 sm:w-auto">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {retryLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
