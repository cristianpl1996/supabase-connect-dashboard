import { AlertCircle, MapPin } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MapStatusBarProps {
  /** Number of records skipped because they failed validation */
  invalidCount: number;
  /** Number of locations currently visible on the map */
  filteredCount: number;
  /** Whether any search/filter is currently active */
  isFiltered: boolean;
  /** Pass true while data is being loaded from an API */
  isLoading?: boolean;
}

/**
 * Displays contextual status messages above the map:
 * - Loading skeleton
 * - Empty state (no data or no matches)
 * - Warning about skipped/invalid records
 */
export function MapStatusBar({
  invalidCount,
  filteredCount,
  isFiltered,
  isLoading = false,
}: MapStatusBarProps) {
  if (isLoading) {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-500 animate-pulse">
          <div className="h-4 w-4 rounded-full bg-gray-200" />
          <div className="h-3 w-40 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const showEmpty = filteredCount === 0;
  const showInvalidWarning = invalidCount > 0;

  if (!showEmpty && !showInvalidWarning) return null;

  return (
    <div className="flex flex-col gap-1.5 px-4 pb-2">
      {showEmpty && (
        <div className="flex items-center gap-2 py-1.5 text-sm text-gray-500">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            {isFiltered
              ? "Ningún punto coincide con los filtros aplicados."
              : "No hay puntos para mostrar."}
          </span>
        </div>
      )}

      {showInvalidWarning && (
        <Alert variant="destructive" className="py-2 text-xs">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {invalidCount} registro{invalidCount !== 1 ? "s" : ""} omitido
            {invalidCount !== 1 ? "s" : ""} por datos inválidos o incompletos.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
