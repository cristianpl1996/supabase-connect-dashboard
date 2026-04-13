import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { MarkerLayer } from "./MarkerLayer";
import { getBounds } from "@/utils/mapUtils";
import type { Customer } from "@/types/map";
import type { SalesRepOption } from "@/hooks/useMapLocations";

import "leaflet/dist/leaflet.css";

// ─── Global Leaflet popup style overrides ─────────────────────────────────────
const POPUP_CSS = `
  .leaflet-popup-content-wrapper {
    padding: 0 !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    box-shadow: 0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08) !important;
    border: 1px solid rgba(0,0,0,0.06) !important;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    line-height: 1.4 !important;
  }
  .leaflet-popup-tip {
    box-shadow: none !important;
  }
  .leaflet-popup-close-button {
    top: 6px !important;
    right: 6px !important;
    width: 20px !important;
    height: 20px !important;
    font-size: 16px !important;
    color: rgba(255,255,255,0.9) !important;
    z-index: 10 !important;
  }
`;

// Fix broken default icon paths with Vite bundler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

// ─── Bounds Controller ────────────────────────────────────────────────────────

function BoundsController({ customers, triggerFit }: { customers: Customer[]; triggerFit: number }) {
  const map = useMap();
  const didMount = useRef(false);
  const prevTrigger = useRef(triggerFit);

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    const bounds = getBounds(customers);
    if (bounds) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevTrigger.current === triggerFit) return;
    prevTrigger.current = triggerFit;
    const bounds = getBounds(customers);
    if (bounds) map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14, duration: 0.9 });
  }, [triggerFit, customers, map]);

  return null;
}

// ─── Zoom control (repositioned to top-right) ─────────────────────────────────

function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const ctrl = L.control.zoom({ position: "topright" });
    ctrl.addTo(map);
    return () => { ctrl.remove(); };
  }, [map]);
  return null;
}

// ─── Sales rep legend ─────────────────────────────────────────────────────────

interface RepLegendProps {
  salesReps: SalesRepOption[];
  activeRepIds: string[];
  onToggleRep: (id: string) => void;
}

function RepLegend({ salesReps, activeRepIds, onToggleRep }: RepLegendProps) {
  if (salesReps.length === 0) return null;

  return (
    <div className="absolute bottom-6 right-2 z-[999] pointer-events-auto">
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-2 max-h-56 overflow-y-auto min-w-[185px]">
        <p className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-1.5 px-0.5">
          Representantes
        </p>
        <div className="flex flex-col gap-0.5">
          {salesReps.map((rep) => {
            const isActive = activeRepIds.includes(rep.id);
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => onToggleRep(rep.id)}
                className={`flex items-center gap-2 rounded px-1.5 py-1 text-left transition-colors w-full group
                  ${isActive
                    ? "font-semibold text-gray-900"
                    : "text-gray-500 hover:text-gray-800"
                  }`}
                style={isActive ? { backgroundColor: `${rep.color}18` } : {}}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all ${isActive ? "ring-2" : "opacity-60 group-hover:opacity-100"}`}
                  style={{ backgroundColor: rep.color, ringColor: rep.color }}
                />
                <span className="leading-tight truncate text-[11px] max-w-[140px]">{rep.name}</span>
              </button>
            );
          })}
        </div>

        {activeRepIds.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-gray-100">
            <button
              type="button"
              onClick={() => activeRepIds.forEach((id) => onToggleRep(id))}
              className="text-[10px] text-gray-400 hover:text-gray-700 px-1.5 transition-colors"
            >
              Mostrar todos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Map View ─────────────────────────────────────────────────────────────────

interface MapViewProps {
  customers: Customer[];
  repColorMap: Map<string, string>;
  salesReps: SalesRepOption[];
  activeRepIds: string[];
  triggerFit: number;
  onToggleRep: (id: string) => void;
}

export function MapView({
  customers,
  repColorMap,
  salesReps,
  activeRepIds,
  triggerFit,
  onToggleRep,
}: MapViewProps) {
  return (
    <div className="relative h-full w-full">
      {/* Inject popup CSS once */}
      <style>{POPUP_CSS}</style>

      <MapContainer
        center={[4.5709, -74.2973]}
        zoom={6}
        className="h-full w-full z-0"
        scrollWheelZoom
        style={{ background: "#e8eaed" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
          maxZoom={19}
        />
        <ZoomControl />
        <BoundsController customers={customers} triggerFit={triggerFit} />
        <MarkerLayer customers={customers} repColorMap={repColorMap} />
      </MapContainer>

      <RepLegend
        salesReps={salesReps}
        activeRepIds={activeRepIds}
        onToggleRep={onToggleRep}
      />
    </div>
  );
}
