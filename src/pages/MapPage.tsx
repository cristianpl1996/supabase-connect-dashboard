import { MapModule } from "@/components/map/MapModule";
import locationsData from "@/data/locations.example.json";

/**
 * MapPage — route at /map
 *
 * Height is calc(100vh - header - page-padding) so the map fills the
 * visible area without overflowing or underflowing.
 * header = 3.5rem (h-14 = 56px)
 * page padding top+bottom = p-6 → 1.5rem * 2 = 3rem  (from AppLayout <main>)
 * Total offset: 6.5rem
 *
 * ─── Connecting to API ───────────────────────────────────────────────────────
 * const { data = [], isLoading } = useQuery({
 *   queryKey: ["customers"],
 *   queryFn: async () => {
 *     const { data, error } = await supabase.from("customers").select("*");
 *     if (error) throw error;
 *     return data;
 *   },
 * });
 * <MapModule data={data} isLoading={isLoading} />
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * -m-6 / -m-10 cancels the <main> p-6 / p-10 padding so the map
 * bleeds to the edge of SidebarInset.  Height accounts for the
 * sticky header (h-14 = 3.5rem) only; no page-padding offset needed.
 */
const MapPage = () => (
  <div className="-m-6 md:-m-10 h-[calc(100vh-3.5rem)] min-h-[480px]">
    <MapModule
      data={locationsData as unknown[]}
      title="Mapa de Clientes"
    />
  </div>
);

export default MapPage;
