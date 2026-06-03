import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface SapStatusBadgeProps {
  campaignNumber?: number | null;
  syncedAt?: string | null;
  syncError?: string | null;
  syncStatus?: string | null;
}

export function SapStatusBadge({ campaignNumber, syncedAt, syncError, syncStatus }: SapStatusBadgeProps) {
  // Pending async sync
  if (syncStatus === 'pending') {
    return (
      <Tooltip>
        <TooltipProvider>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1 cursor-default">
              <Loader2 className="h-3 w-3 text-amber-500 animate-spin shrink-0" />
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs">
                Sincronizando…
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Enviando promoción a SAP</p>
          </TooltipContent>
        </TooltipProvider>
      </Tooltip>
    );
  }

  // No sync at all
  if (!campaignNumber && !syncError) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  // Error state
  if (syncError) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
            <Badge
              variant="outline"
              className="cursor-pointer border-red-300 bg-red-50 text-red-700 hover:bg-red-100 text-xs"
            >
              Error
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
            <div className="space-y-1.5 text-xs">
              {campaignNumber && (
                <p className="font-medium text-foreground">Campaña SAP: #{campaignNumber}</p>
              )}
              {!campaignNumber && (
                <p>Error de sincronización SAP: </p>
              )}
              <p className="text-red-700 max-h-32 overflow-y-auto break-words">{syncError}</p>
              {syncedAt && (
                <p>
                  Último intento: {formatDistanceToNow(parseISO(syncedAt), { addSuffix: true, locale: es })}
                </p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Synced state
  const syncedDate = syncedAt ? parseISO(syncedAt) : null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('flex items-center gap-1 cursor-default')}>
            <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
            <Badge
              variant="outline"
              className="border-green-300 bg-green-50 text-green-700 text-xs font-mono"
            >
              #{campaignNumber}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
            <span>
              {syncedDate
                ? `Sincronizado: ${format(syncedDate, 'dd MMM yyyy HH:mm', { locale: es })}`
                : 'Sincronizado con SAP'}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
