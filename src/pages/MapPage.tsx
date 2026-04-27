import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { MapModule } from "@/components/map/MapModule";
import { getMapCustomersBatch, type CustomerRecord } from "@/lib/api";

const PAGE = 2000;

type BadgePhase = "loading" | "done" | "fading" | "hidden";

export default function MapPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<BadgePhase>("loading");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let offset = 0;

    async function fetchNext() {
      try {
        const batch = await getMapCustomersBatch(offset);

        setCustomers((prev) => [...prev, ...batch]);
        setTotalLoaded((prev) => prev + batch.length);

        if (batch.length === PAGE) {
          offset += PAGE;
          void fetchNext();
        } else {
          setBadge("done");
          setTimeout(() => setBadge("fading"), 1800);
          setTimeout(() => setBadge("hidden"), 3000);
        }
      } catch (err) {
        setError((err as Error).message);
        setBadge("hidden");
      }
    }

    void fetchNext();
  }, []);

  if (error && customers.length === 0) {
    return (
      <div className="-mx-3 -my-4 flex h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-3 sm:-mx-5 md:-mx-8 md:-my-8 xl:-mx-10">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold text-gray-800">Error al cargar clientes</p>
        <p className="max-w-xs text-center text-xs text-red-600">{error}</p>
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
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                {badge === "loading" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900">
                    {badge === "loading" ? "Cargando clientes" : "Mapa listo"}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">
                    {totalLoaded.toLocaleString("es-CO")} {badge === "loading" ? "encontrados hasta ahora" : "clientes en el mapa"}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                {badge === "loading" ? "Sincronizando" : "Listo"}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden bg-gray-100">
              {badge === "loading" ? (
                <div className="h-full animate-[progress_1.4s_ease-in-out_infinite] bg-primary" style={{ width: "40%" }} />
              ) : (
                <div className="h-full w-full bg-green-500 transition-all duration-500" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
