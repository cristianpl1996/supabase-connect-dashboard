import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";

import { MapModule } from "@/components/map/MapModule";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { getMapCustomersBatch } from "@/lib/api";

const PAGE = 2000;

type BadgePhase = "loading" | "done" | "fading" | "hidden";

export default function MapPage() {
  const [badge, setBadge] = useState<BadgePhase>("loading");

  const {
    data,
    isLoading: initialLoading,
    isError,
    error: queryError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['map-customers'],
    queryFn: ({ pageParam }) => getMapCustomersBatch(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE ? allPages.flatMap((p) => p).length : undefined,
    staleTime: 5 * 60_000,
  });

  const customers = useMemo(
    () => data?.pages.flatMap((p) => p) ?? [],
    [data],
  );
  const totalLoaded = customers.length;
  const error = isError ? (queryError instanceof Error ? queryError.message : 'Error al cargar clientes') : null;

  // Auto-cargar el siguiente batch mientras haya más
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Gestión del badge una vez que todos los batches cargaron
  const isLoadingAll = initialLoading || isFetchingNextPage || hasNextPage;
  useEffect(() => {
    if (!isLoadingAll && !isError) {
      setBadge("done");
      const t1 = setTimeout(() => setBadge("fading"), 1800);
      const t2 = setTimeout(() => setBadge("hidden"), 3000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [isLoadingAll, isError]);

  if (initialLoading && customers.length === 0 && !error) {
    return (
      <div className="-mx-3 -my-4 flex h-[calc(100svh-3.5rem)] items-center justify-center bg-slate-50 px-4 dark:bg-background sm:-mx-5 md:-mx-8 md:-my-8 xl:-mx-10">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex size-24 items-center justify-center">
            <span className="absolute size-12 animate-ping rounded-full bg-primary/20" />
            <span className="absolute size-16 animate-ping rounded-full bg-primary/10 [animation-delay:180ms]" />
            <span className="absolute size-20 animate-ping rounded-full bg-primary/5 [animation-delay:360ms]" />
            <Loader2 className="relative size-8 animate-spin text-primary" />
          </div>
          <h2 className="mt-3 text-base font-bold text-foreground">Cargando mapa de clientes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Preparando clientes georreferenciados</p>
        </div>
      </div>
    );
  }

  if (error && customers.length === 0) {
    return (
      <div className="-mx-3 -my-4 flex h-[calc(100svh-3.5rem)] items-center justify-center bg-slate-50 px-4 dark:bg-background sm:-mx-5 md:-mx-8 md:-my-8 xl:-mx-10">
        <div className="w-full max-w-3xl">
          <ModuleErrorCard message={error} onRetry={() => void refetch()} loading={initialLoading} />
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-3 -my-4 relative h-[calc(100svh-3.5rem)] min-h-[480px] sm:-mx-5 md:-mx-8 md:-my-8 xl:-mx-10">
      <MapModule
        data={customers}
        title="Mapa de Clientes"
        controlsDisabled={badge === "loading"}
      />

      {badge !== "hidden" && (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 z-[1000] w-[calc(100%-1.5rem)] max-w-xs -translate-x-1/2 transition-opacity duration-1000 sm:max-w-sm"
          style={{ opacity: badge === "fading" ? 0 : 1 }}
        >
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-border dark:bg-card">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                {badge === "loading" ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900 dark:text-foreground">
                    {badge === "loading" ? "Cargando clientes" : "Mapa listo"}
                  </p>
                  <p className="truncate text-[11px] text-gray-500 dark:text-muted-foreground">
                    {totalLoaded.toLocaleString("es-CO")} {badge === "loading" ? "encontrados hasta ahora" : "clientes en el mapa"}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                {badge === "loading" ? "Sincronizando" : "Listo"}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden bg-gray-100 dark:bg-muted">
              {badge === "loading" ? (
                <div className="h-full animate-[progress_1.4s_ease-in-out_infinite] bg-primary" style={{ width: "40%" }} />
              ) : (
                <div className="size-full bg-green-500 transition-all duration-500" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
