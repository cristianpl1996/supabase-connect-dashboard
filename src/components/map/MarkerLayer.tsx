import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { LocationPopup } from "./LocationPopup";
import type { Customer } from "@/types/map";

// ─── SVG pin icon factory ─────────────────────────────────────────────────────

function createPinIcon(color: string): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 38" width="26" height="38">
      <filter id="s" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.30)"/>
      </filter>
      <path
        d="M13 0C5.8 0 0 5.8 0 13c0 8.8 13 25 13 25s13-16.2 13-25C26 5.8 20.2 0 13 0z"
        fill="${color}" filter="url(#s)"
      />
      <circle cx="13" cy="13" r="5" fill="white" opacity="0.90"/>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [26, 38],
    iconAnchor: [13, 38],   // bottom-center of pin
    popupAnchor: [0, -40],  // opens just above the pin tip
  });
}

const iconCache = new Map<string, L.DivIcon>();
function getCachedIcon(color: string): L.DivIcon {
  if (!iconCache.has(color)) iconCache.set(color, createPinIcon(color));
  return iconCache.get(color)!;
}

// ─── MarkerLayer ──────────────────────────────────────────────────────────────

interface MarkerLayerProps {
  customers: Customer[];
  repColorMap: Map<string, string>;
}

export function MarkerLayer({ customers, repColorMap }: MarkerLayerProps) {
  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={50}
      showCoverageOnHover={false}
      animate
    >
      {customers.map((customer) => {
        const color = repColorMap.get(customer.sales_rep_full_name) ?? "#64748b";
        return (
          <Marker
            key={customer.id}
            position={[customer.latitude, customer.longitude]}
            icon={getCachedIcon(color)}
          >
            <Popup
              maxWidth={340}
              minWidth={300}
              closeButton
              // Keep popup fully inside the visible map area
              autoPanPaddingTopLeft={[28, 28]}
              autoPanPaddingBottomRight={[28, 28]}
            >
              <LocationPopup customer={customer} repColor={color} />
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
