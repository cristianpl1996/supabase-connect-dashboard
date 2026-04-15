import type { LatLngBoundsExpression } from "leaflet";
import type { Customer, ParseResult, ProductSnapshot } from "@/types/map";

// ─── Normalization helpers ────────────────────────────────────────────────────

function nullify(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.toUpperCase() === "NULL") return null;
  return typeof v === "string" ? v : null;
}

function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return false;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && !isNaN(v);
}

/** Parses a semicolon-separated email string into a clean array */
function parseEmails(v: unknown): string[] {
  const raw = nullify(v);
  if (!raw) return [];
  return raw
    .split(";")
    .map((e) => e.trim())
    .filter(Boolean);
}

function parseProductSnapshots(v: unknown): ProductSnapshot[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (item): item is ProductSnapshot =>
      item !== null &&
      typeof item === "object" &&
      typeof (item as ProductSnapshot).product === "string" &&
      typeof (item as ProductSnapshot).quantity === "number"
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Coerces a value that may arrive as string or number into a finite number */
function toNumber(v: unknown): number {
  if (isFiniteNumber(v)) return v;
  if (typeof v === "string") { const n = parseFloat(v); if (isFinite(n)) return n; }
  return 0;
}

export function validateCustomer(record: unknown): Customer | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;

  // ── Lat/lng: API uses customer_business_latitude/longitude; JSON uses latitude/longitude ──
  const lat = isFiniteNumber(r.customer_business_latitude) ? r.customer_business_latitude
            : isFiniteNumber(r.latitude)                   ? r.latitude
            : null;
  const lng = isFiniteNumber(r.customer_business_longitude) ? r.customer_business_longitude
            : isFiniteNumber(r.longitude)                    ? r.longitude
            : null;

  // Require valid id, full name, and coordinates within bounds
  if (
    typeof r.id !== "number" ||
    lat === null || lng === null ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
    typeof r.customer_full_name !== "string" || !r.customer_full_name.trim()
  ) {
    return null;
  }

  return {
    id: r.id,
    distributor_id: typeof r.distributor_id === "number" ? r.distributor_id : 0,
    customer_government_id:
      typeof r.customer_government_id === "string" || typeof r.customer_government_id === "number"
        ? String(r.customer_government_id).trim()
        : "N/A",
    customer_full_name: (r.customer_full_name as string).trim(),
    customer_business_type:
      typeof r.customer_business_type === "string" && r.customer_business_type.trim()
        ? r.customer_business_type.trim()
        : "Sin clasificar",
    // cellphone may arrive as string or number
    customer_cellphone:
      typeof r.customer_cellphone === "number" ? r.customer_cellphone
      : typeof r.customer_cellphone === "string" && r.customer_cellphone.trim()
        ? r.customer_cellphone.trim()
        : null,
    customer_emails: parseEmails(r.customer_email),
    customer_business_address:
      typeof r.customer_business_address === "string" ? r.customer_business_address.trim() : "",
    latitude:  lat,
    longitude: lng,
    customer_age_range: nullify(r.customer_age_range),
    customer_biological_sex:
      typeof r.customer_biological_sex === "number" ? r.customer_biological_sex : null,
    customer_average_days_between_purchases: toNumber(r.customer_average_days_between_purchases),
    customer_average_purchase_ticket_amount: toNumber(r.customer_average_purchase_ticket_amount),
    customer_total_lifetime_revenue:        toNumber(r.customer_total_lifetime_revenue),
    customer_total_number_of_purchases:     toNumber(r.customer_total_number_of_purchases),
    customer_days_since_last_purchase:      toNumber(r.customer_days_since_last_purchase),
    customer_clv_segment:                   toNumber(r.customer_clv_segment),
    // rfm_segment arrives as string from the API ("331") or number from JSON (122)
    customer_rfm_segment:                   toNumber(r.customer_rfm_segment),
    customer_top_purchased_products_snapshot:
      parseProductSnapshots(r.customer_top_purchased_products_snapshot),
    customer_is_government_employee:        coerceBool(r.customer_is_government_employee),
    customer_is_politically_exposed_person: coerceBool(r.customer_is_politically_exposed_person),
    customer_has_confirmed_digital_wallet:  coerceBool(r.customer_has_confirmed_digital_wallet),
    sales_representative_id:
      typeof r.sales_representative_id === "number" ? r.sales_representative_id : 0,
    sales_rep_full_name:
      typeof r.sales_rep_full_name === "string" && r.sales_rep_full_name.trim()
        ? r.sales_rep_full_name.trim() : "Sin asignar",
    sales_rep_coverage_area:
      typeof r.sales_rep_coverage_area === "string" && r.sales_rep_coverage_area.trim()
        ? r.sales_rep_coverage_area.trim() : "Sin zona",
    created_at: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString(),
  };
}

export function parseCustomers(data: unknown[]): ParseResult {
  const valid: Customer[] = [];
  let invalidCount = 0;
  for (const record of data) {
    const customer = validateCustomer(record);
    if (customer) { valid.push(customer); } else { invalidCount++; }
  }
  return { valid, invalidCount };
}

// ─── Map utilities ────────────────────────────────────────────────────────────

export function getBounds(customers: Customer[]): LatLngBoundsExpression | null {
  if (customers.length === 0) return null;
  const lats = customers.map((c) => c.latitude);
  const lngs = customers.map((c) => c.longitude);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

export function uniqueSorted(values: (string | number)[]): string[] {
  return [...new Set(values.map(String))].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true })
  );
}

// ─── Color system for sales reps ─────────────────────────────────────────────

/**
 * A palette of 15 visually distinct, accessible colors.
 * Assigned deterministically so the same rep always gets the same color
 * across renders and sessions.
 */
export const REP_PALETTE = [
  "#E63946", // red
  "#2A9D8F", // teal
  "#457B9D", // steel blue
  "#F4A261", // orange
  "#6A0572", // purple
  "#2DC653", // green
  "#FB8500", // amber
  "#8338EC", // violet
  "#0096C7", // cyan
  "#FF595E", // coral
  "#3A86FF", // bright blue
  "#FFCA3A", // yellow
  "#6A4C93", // indigo
  "#06D6A0", // mint
  "#EF476F", // pink
];

/** Builds a stable repName → hex color map sorted alphabetically */
export function buildRepColorMap(customers: Customer[]): Map<string, string> {
  const names = [...new Set(customers.map((c) => c.sales_rep_full_name))].sort();
  return new Map(names.map((name, i) => [name, REP_PALETTE[i % REP_PALETTE.length]]));
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const formatCOP = (n: number) => COP.format(n);

export function parseRFM(code: number): { r: number; f: number; m: number } {
  const s = String(Math.round(code)).padStart(3, "0");
  return { r: parseInt(s[0], 10), f: parseInt(s[1], 10), m: parseInt(s[2], 10) };
}

export const SEX_LABELS: Record<number, string> = { 1: "Masculino", 2: "Femenino" };
