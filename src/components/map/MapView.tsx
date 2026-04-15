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
    width: auto !important;
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

    </div>
  );
}
