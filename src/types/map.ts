/** A product entry from customer_top_purchased_products_snapshot */
export interface ProductSnapshot {
  product: string;
  quantity: number;
}

/**
 * Normalized customer record — matches the real API/DB model exactly.
 * "NULL" strings → null, "True"/"False" strings → boolean (handled in mapUtils).
 */
export interface Customer {
  id: number;
  distributor_id: number;

  // Identity
  customer_government_id: string;
  customer_full_name: string;
  customer_business_type: string;

  // Contact
  customer_cellphone: string | number | null;
  customer_emails: string[];        // parsed from semicolon-separated string
  customer_business_address: string;

  // Geographic
  latitude: number;
  longitude: number;

  // Demographics
  customer_age_range: string | null;
  customer_biological_sex: number | null;

  // Commercial metrics
  customer_average_days_between_purchases: number;
  customer_average_purchase_ticket_amount: number;
  customer_total_lifetime_revenue: number;
  customer_total_number_of_purchases: number;
  customer_days_since_last_purchase: number;
  customer_clv_segment: number;
  customer_rfm_segment: number;
  customer_top_purchased_products_snapshot: ProductSnapshot[];

  // Flags
  customer_is_government_employee: boolean;
  customer_is_politically_exposed_person: boolean;
  customer_has_confirmed_digital_wallet: boolean;

  // Sales representative (primary dimension)
  sales_representative_id: number;
  sales_rep_full_name: string;
  sales_rep_coverage_area: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * All filter values for the map panel.
 * Range fields are stored as strings to bind cleanly to <input type="number">.
 * Empty string always means "no filter applied".
 */
export interface CustomerFilters {
  // Full-text search
  search: string;

  // Sales rep (top priority) — array enables multi-select
  sales_rep_ids: string[];
  coverage_area: string;

  // Categorical
  business_type: string;

  // Numeric ranges
  min_ltv: string;
  max_ltv: string;
  min_ticket: string;
  max_ticket: string;
  min_days_since_purchase: string;
  max_days_since_purchase: string;
}

/** Result of parsing and validating a raw JSON array */
export interface ParseResult {
  valid: Customer[];
  invalidCount: number;
}

/** Props accepted by the top-level MapModule component */
export interface MapModuleProps {
  data: unknown[];
  title?: string;
  isLoading?: boolean;
  controlsDisabled?: boolean;
}
