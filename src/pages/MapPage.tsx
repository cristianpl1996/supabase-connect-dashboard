import { useEffect, useRef, useState } from "react";
import { MapModule } from "@/components/map/MapModule";
import { getMapCustomersBatch, type CustomerRecord } from "@/lib/api";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

const PAGE = 2000;

// Badge phases: loading → done (visible) → done (fading) → hidden
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
          fetchNext();
        } else {
          // Show success state, then fade out
          setBadge("done");
          setTimeout(() => setBadge("fading"), 1800);
          setTimeout(() => setBadge("hidden"), 3000);
        }
      } catch (err) {
        setError((err as Error).message);
        setBadge("hidden");
      }
    }

    fetchNext();
  }, []);

  /* ── Error (only block if no data at all) ──────────────────────────────── */
  if (error && customers.length === 0) {
    return (
      <div className="-m-6 md:-m-10 h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-3">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold text-gray-800">Error al cargar clientes</p>
        <p className="text-xs text-red-600 max-w-xs text-center">{error}</p>
      </div>
    );
  }

  /* ── Map (always rendered) + floating progress badge ──────────────────── */
  return (
    <div className="-m-6 md:-m-10 h-[calc(100vh-3.5rem)] min-h-[480px] relative">
      <MapModule
        data={customers}
        title="Mapa de Clientes"
      />

      {badge !== "hidden" && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none transition-opacity duration-[1200ms]"
          style={{ opacity: badge === "fading" ? 0 : 1 }}
        >
          <div className="rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 shadow-md overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-600">
              {badge === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
              <span>
                {badge === "loading" ? "Cargando clientes…" : "Listo —"}{" "}
                <span className="font-semibold text-gray-800">{totalLoaded.toLocaleString("es-CO")}</span>{" "}
                {badge === "loading" ? "encontrados" : "clientes en el mapa"}
              </span>
            </div>
            {/* Progress bar: indeterminate while loading, full green when done */}
            <div className="h-0.5 w-full bg-gray-100 overflow-hidden">
              {badge === "loading" ? (
                <div className="h-full bg-primary animate-[progress_1.4s_ease-in-out_infinite]" style={{ width: "40%" }} />
              ) : (
                <div className="h-full bg-green-500 w-full transition-all duration-500" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
