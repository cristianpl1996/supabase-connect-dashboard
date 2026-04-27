import { useCallback, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { useMapLocations } from "@/hooks/useMapLocations";
import { FilterPanel } from "./FilterPanel";
import { MapStatusBar } from "./MapStatusBar";
import { MapView } from "./MapView";
import type { MapModuleProps } from "@/types/map";

export function MapModule({ data, title = "Mapa de Clientes", isLoading = false, controlsDisabled = false }: MapModuleProps) {
  const [fitTrigger, setFitTrigger] = useState(0);

  const {
    filters,
    setFilter,
    resetFilters,
    filteredCustomers,
    allCustomers,
    activeFilterCount,
    repColorMap,
    options,
    parseResult,
  } = useMapLocations(data);

  const handleZoomToAll = useCallback(() => setFitTrigger((n) => n + 1), []);

  // Toggle a rep in the multi-select array (used by the map legend)
  const handleToggleRep = useCallback(
    (id: string) => {
      setFilter(
        "sales_rep_ids",
        filters.sales_rep_ids.includes(id)
          ? filters.sales_rep_ids.filter((s) => s !== id)
          : [...filters.sales_rep_ids, id]
      );
    },
    [filters.sales_rep_ids, setFilter]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">

      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3 py-3 sm:px-4">
        <MapIcon className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="text-muted-foreground text-sm">
            {allCustomers.length.toLocaleString("es-CO")} clientes · {options.salesReps.length} representantes
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0">
        <FilterPanel
          filters={filters}
          options={options}
          totalCount={allCustomers.length}
          filteredCount={filteredCustomers.length}
          activeFilterCount={activeFilterCount}
          onFilter={setFilter}
          onReset={resetFilters}
          onZoomToAll={handleZoomToAll}
          disabled={controlsDisabled}
        />
      </div>

      {/* Status messages */}
      <div className="shrink-0">
        <MapStatusBar
          invalidCount={parseResult.invalidCount}
          filteredCount={filteredCustomers.length}
          isFiltered={activeFilterCount > 0}
          isLoading={isLoading}
        />
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-0">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
            <span className="text-sm text-gray-400">Cargando mapa…</span>
          </div>
        ) : (
          <MapView
            customers={filteredCustomers}
            repColorMap={repColorMap}
            salesReps={options.salesReps}
            activeRepIds={filters.sales_rep_ids}
            triggerFit={fitTrigger}
            onToggleRep={handleToggleRep}
          />
        )}
      </div>
    </div>
  );
}
