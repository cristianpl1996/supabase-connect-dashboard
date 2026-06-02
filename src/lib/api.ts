// ─── Base URL ─────────────────────────────────────────────────────────────────
export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)
  ?? "https://api-ivanagro.bettercode.com.co";

// ─── Token helpers (localStorage) ────────────────────────────────────────────
const TOKEN_KEY = "ivanagro_access_token";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers ?? undefined);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.detail ?? body?.message ?? `Error ${res.status}`;
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("ivanagro:unauthorized", { detail: message }));
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

async function publicApiFetch<T>(path: string, options: RequestInit = {}, ecommerceToken?: string | null): Promise<T> {
  const headers = new Headers(options.headers ?? undefined);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (ecommerceToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${ecommerceToken}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.detail ?? body?.message ?? `Error ${res.status}`;
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("ivanagro:ecommerce_unauthorized", { detail: message }));
    }
    throw new ApiError(res.status, typeof message === "string" ? message : JSON.stringify(message));
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  role?: string;
  distributor_id?: number;
  sales_representative_id?: number;
  laboratory_id?: string;
  approval_limit?: number | null;
  is_promoter?: boolean;
  requires_otp?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
  otp_required?: boolean;
}

export interface OtpChallengeResponse {
  otp_required: true;
  otp_token: string;
  expires_at: string;
  phone_hint?: string;
}

export type LoginResponse = TokenResponse | OtpChallengeResponse;

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export interface OtpVerifyRequest {
  otp_token: string;
  code: string;
}

export function verifyOtp(payload: OtpVerifyRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/v1/auth/login/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Public e-commerce
export interface EcommerceCustomer {
  id: number;
  government_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface EcommerceSession {
  ecommerce_token: string;
  expires_at: string;
  customer: EcommerceCustomer;
}

export interface EcommerceOtpChallenge {
  otp_required: true;
  otp_token: string;
  expires_at: string;
  phone_hint?: string;
}

export type EcommerceSessionOrChallenge = EcommerceSession | EcommerceOtpChallenge;

export interface EcommerceProduct {
  product_sku: string;
  product_commercial_name?: string | null;
  product_technical_description?: string | null;
  product_unit_of_measurement?: string | null;
  product_brand_name?: string | null;
  external_product_id?: string | null;
  product_image_url?: string | null;
  product_industry_sector?: string | null;
  product_category?: string | null;
  product_target_animal_species?: string | null;
  product_line_name?: string | null;
  product_is_catalog_verified?: boolean | null;
  product_is_discontinued?: boolean | null;
  total_units_available?: number | null;
  inventory_locations_count?: number | null;
  price?: number | null;
  price_list?: string | null;
  can_add_to_cart?: boolean | null;
  [key: string]: unknown;
}

export interface EcommerceFilterOptions {
  brands: string[];
  categories: string[];
}

export interface EcommerceProductParams {
  search?: string;
  brand_name?: string;
  category?: string;
  in_stock_only?: boolean;
  with_price_only?: boolean;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface EcommerceCartItemInput {
  sku: string;
  quantity: number;
}

export interface EcommerceCartQuoteItem {
  line_number: number;
  sku: string;
  product_name?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  price_list?: string | null;
  available: number;
  can_add_to_cart: boolean;
}

export interface EcommerceCartQuote {
  items: EcommerceCartQuoteItem[];
  subtotal: number;
  total: number;
  errors: Array<{ sku: string; message: string }>;
}

export interface EcommerceCheckoutPayload {
  items: EcommerceCartItemInput[];
  contact_name: string;
  contact_phone: string;
  contact_email?: string;
  delivery_address: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  payment_method?: string;
  observations?: string;
}

export interface EcommerceOrderDraft {
  id: string;
  reference: string;
  status: string;
  customer: EcommerceCustomer;
  items: EcommerceCartQuoteItem[];
  subtotal: number;
  total: number;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
}

export function createEcommerceSession(customer_government_id: string): Promise<EcommerceSessionOrChallenge> {
  return publicApiFetch<ApiDetailResponse<EcommerceSessionOrChallenge>>("/api/v1/e-commerce/session", {
    method: "POST",
    body: JSON.stringify({ customer_government_id }),
  }).then((res) => res.data);
}

export function verifyEcommerceOtp(payload: { otp_token: string; code: string }): Promise<EcommerceSession> {
  return publicApiFetch<ApiDetailResponse<EcommerceSession>>("/api/v1/e-commerce/session/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((res) => res.data);
}

export function getEcommerceProductsPage(token: string, params: EcommerceProductParams = {}): Promise<ApiListResponse<EcommerceProduct>> {
  return publicApiFetch<ApiListResponse<EcommerceProduct>>(withQuery("/api/v1/e-commerce/products", {
    search: params.search,
    brand_name: params.brand_name,
    category: params.category,
    in_stock_only: params.in_stock_only,
    with_price_only: params.with_price_only,
    sort_by: params.sort_by,
    sort_dir: params.sort_dir,
    limit: params.limit ?? 24,
    offset: params.offset ?? 0,
  }), {}, token);
}

export function getEcommerceProduct(token: string, sku: string): Promise<EcommerceProduct> {
  return publicApiFetch<ApiDetailResponse<EcommerceProduct>>(`/api/v1/e-commerce/products/${encodeURIComponent(sku)}`, {}, token)
    .then((res) => res.data);
}

export function getEcommerceFilterOptions(token: string): Promise<EcommerceFilterOptions> {
  return publicApiFetch<ApiDetailResponse<EcommerceFilterOptions>>("/api/v1/e-commerce/products/filter-options", {}, token)
    .then((res) => res.data);
}

export function quoteEcommerceCart(token: string, items: EcommerceCartItemInput[]): Promise<EcommerceCartQuote> {
  return publicApiFetch<ApiDetailResponse<EcommerceCartQuote>>("/api/v1/e-commerce/cart/quote", {
    method: "POST",
    body: JSON.stringify({ items }),
  }, token).then((res) => res.data);
}

export function checkoutEcommerce(token: string, payload: EcommerceCheckoutPayload): Promise<EcommerceOrderDraft> {
  return publicApiFetch<ApiDetailResponse<EcommerceOrderDraft>>("/api/v1/e-commerce/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token).then((res) => res.data);
}

export interface EcommerceOrderItem {
  line_number: number;
  product_sku: string;
  product_name?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface EcommerceMyOrder {
  id: string;
  reference: string;
  status: string;
  subtotal: number;
  total: number;
  contact_name?: string | null;
  delivery_address?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  items_count: number;
  items: EcommerceOrderItem[];
  created_at: string;
}

export function listMyEcommerceOrders(token: string, limit = 20, offset = 0): Promise<ApiListResponse<EcommerceMyOrder>> {
  return publicApiFetch<ApiListResponse<EcommerceMyOrder>>(
    withQuery("/api/v1/e-commerce/my-orders", { limit, offset }),
    {},
    token,
  );
}

// ─── Generic paginated response ───────────────────────────────────────────────
// List API shape: { data, meta: { limit, offset, count } }
interface ApiMeta { limit: number; offset: number; count: number; }
export interface ApiListResponse<T> {
  data: T[];
  meta: ApiMeta;
}
interface ApiDetailResponse<T> { data: T; meta: { count?: number }; }

function listResults<T>(res: ApiListResponse<T>): T[] {
  return res.data ?? [];
}

export function listTotal<T>(res: ApiListResponse<T>): number | null {
  return Number.isFinite(res.meta?.count) ? Number(res.meta.count) : null;
}

async function apiList<T>(path: string): Promise<T[]> {
  const res = await apiFetch<ApiListResponse<T>>(path);
  return listResults(res);
}

async function apiDetail<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch<ApiDetailResponse<T>>(path, options);
  return res.data;
}

function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

// ─── Customers ────────────────────────────────────────────────────────────────
export interface CustomerParams {
  search?: string;
  business_type?: string;
  customer_clv_segment?: string;
  customer_rfm_segment?: string;
  government_id?: string;
  city?: string;
  state?: string;
  sales_representative_id?: number;
  has_sales_representative?: boolean;
  has_location?: boolean;
  min_revenue?: number;
  max_revenue?: number;
  min_purchases?: number;
  max_purchases?: number;
  min_average_ticket?: number;
  max_average_ticket?: number;
  min_days_since_last_purchase?: number;
  max_days_since_last_purchase?: number;
  customer_is_valid?: boolean;
  customer_is_frozen?: boolean;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

// Loosely typed — mapUtils validates and normalises each field.
export type CustomerRecord = Record<string, unknown>;

export type SaleRecord = Record<string, unknown>;
export type TracingRecord = Record<string, unknown>;

export interface FilterOptionItem {
  value: string;
  label: string;
}

export interface CustomerFilterOptions {
  business_types: string[];
  clv_segments: FilterOptionItem[];
  rfm_segments: FilterOptionItem[];
}

export interface Representative {
  id: number;
  sales_representative_id?: number;
  distributor_id?: number | null;
  sales_rep_full_name?: string | null;
  sales_rep_coverage_area?: string | null;
  sales_rep_cellphone?: string | null;
  sales_rep_email?: string | null;
  sales_rep_profile_type?: string | null;
  sales_rep_status?: string | null;
  sales_rep_job_title?: string | null;
  [key: string]: unknown;
}

export interface CustomerTopProduct {
  product_sku: string | null;
  product_commercial_name: string | null;
  product_brand_name: string | null;
  total_units: number | null;
  total_revenue: number | null;
  last_purchase_date: string | null;
}

export interface OrderLineItem {
  id: number;
  commercial_order_id: number;
  product_catalog_code?: string | null;
  sold_product_sku_at_order?: string | null;
  sold_product_name_at_order?: string | null;
  sold_service_internal_code?: string | null;
  sold_service_name?: string | null;
  line_num?: number | null;
  warehouse_code?: string | null;
  line_item_status_code?: string | null;
  line_item_discount_applied?: number | null;
  line_item_bonus_applied?: number | null;
  line_item_vat_percentage?: number | null;
  line_item_quantity_sold?: number | null;
  line_item_unit_price_before_taxes?: number | null;
  line_item_total_price_after_taxes?: number | null;
  product_recommended_reapplication_frequency?: string | null;
  line_item_is_part_of_active_campaign?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface Order {
  id: number;
  source_sale_id?: number | null;
  distributor_id?: number | null;
  customer_id?: number | null;
  sales_representative_id?: number | null;
  sales_representative_name?: string | null;
  sales_representative_email?: string | null;
  sales_representative_phone?: string | null;
  order_taking_person_name?: string | null;
  order_number: string;
  buyer_internal_code_at_sale?: string | null;
  buyer_full_name_at_sale?: string | null;
  buyer_cellphone_at_sale?: string | null;
  buyer_email_at_sale?: string | null;
  order_status_code?: string | null;
  order_delivery_address?: string | null;
  order_payment_method?: string | null;
  order_additional_observations?: string | null;
  order_origin_channel?: string | null;
  order_origin_platform?: string | null;
  sap_doc_date?: string | null;
  sell_at?: string | null;
  doc_total?: number | null;
  sale_invoice_number?: string | null;
  sale_status_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  line_items_count?: number | null;
  line_items_total_quantity?: number | null;
  line_items_total_amount?: number | null;
  line_items?: OrderLineItem[];
  [key: string]: unknown;
}

export interface OrderListParams {
  search?: string;
  customer_id?: number;
  sales_representative_id?: number;
  status?: string;
  origin_channel?: string;
  origin_platform?: string;
  payment_method?: string;
  invoice_number?: string;
  has_observations?: boolean;
  date_from?: string;
  date_to?: string;
  min_total?: number;
  max_total?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface OrderFilterOptions {
  statuses: string[];
  origin_channels: string[];
  payment_methods: string[];
}

export async function getCustomersPage(params: CustomerParams = {}): Promise<ApiListResponse<CustomerRecord>> {
  const qs = new URLSearchParams();
  if (params.search)        qs.set("search", params.search);
  if (params.business_type) qs.set("business_type", params.business_type);
  if (params.customer_clv_segment) qs.set("customer_clv_segment", params.customer_clv_segment);
  if (params.customer_rfm_segment) qs.set("customer_rfm_segment", params.customer_rfm_segment);
  if (params.government_id) qs.set("government_id", params.government_id);
  if (params.city) qs.set("city", params.city);
  if (params.state) qs.set("state", params.state);
  if (params.sales_representative_id) qs.set("sales_representative_id", String(params.sales_representative_id));
  if (params.has_sales_representative !== undefined) qs.set("has_sales_representative", String(params.has_sales_representative));
  if (params.has_location !== undefined) qs.set("has_location", String(params.has_location));
  if (params.min_revenue !== undefined) qs.set("min_revenue", String(params.min_revenue));
  if (params.max_revenue !== undefined) qs.set("max_revenue", String(params.max_revenue));
  if (params.min_purchases !== undefined) qs.set("min_purchases", String(params.min_purchases));
  if (params.max_purchases !== undefined) qs.set("max_purchases", String(params.max_purchases));
  if (params.min_average_ticket !== undefined) qs.set("min_average_ticket", String(params.min_average_ticket));
  if (params.max_average_ticket !== undefined) qs.set("max_average_ticket", String(params.max_average_ticket));
  if (params.min_days_since_last_purchase !== undefined) qs.set("min_days_since_last_purchase", String(params.min_days_since_last_purchase));
  if (params.max_days_since_last_purchase !== undefined) qs.set("max_days_since_last_purchase", String(params.max_days_since_last_purchase));
  if (params.customer_is_valid !== undefined) qs.set("customer_is_valid", String(params.customer_is_valid));
  if (params.customer_is_frozen !== undefined) qs.set("customer_is_frozen", String(params.customer_is_frozen));
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  qs.set("limit",  String(params.limit  ?? 100));
  qs.set("offset", String(params.offset ?? 0));
  return apiFetch<ApiListResponse<CustomerRecord>>(`/api/v1/customers?${qs}`);
}

export async function listCustomers(params: CustomerParams = {}): Promise<CustomerRecord[]> {
  const res = await getCustomersPage(params);
  return listResults(res);
}

export function getCustomerFilterOptions(): Promise<CustomerFilterOptions> {
  return apiDetail<CustomerFilterOptions>("/api/v1/customers/filter-options");
}

export async function getAllRepresentatives(): Promise<Representative[]> {
  const pageSize = 200;
  const first = await apiFetch<ApiListResponse<Representative>>(withQuery("/api/v1/representatives", {
    limit: pageSize,
    offset: 0,
  }));
  const total = listTotal(first);
  const pages = [first.data ?? []];

  if (total !== null && total > pageSize) {
    const requests: Array<Promise<ApiListResponse<Representative>>> = [];
    for (let offset = pageSize; offset < total; offset += pageSize) {
      requests.push(apiFetch<ApiListResponse<Representative>>(withQuery("/api/v1/representatives", {
        limit: pageSize,
        offset,
      })));
    }
    const rest = await Promise.all(requests);
    rest.forEach((page) => pages.push(page.data ?? []));
  }

  return pages
    .flat()
    .sort((a, b) => String(a.sales_rep_full_name ?? "").localeCompare(String(b.sales_rep_full_name ?? ""), "es-CO"));
}

export function getCustomer(customerId: number): Promise<CustomerRecord> {
  return apiDetail<CustomerRecord>(`/api/v1/customers/${customerId}`);
}

export function listCustomerSales(customerId: number, limit = 20): Promise<SaleRecord[]> {
  return apiList<SaleRecord>(withQuery("/api/v1/sales", {
    customer_id: customerId,
    limit,
    offset: 0,
  }));
}

export function listCustomerTracing(customerId: number, limit = 20): Promise<TracingRecord[]> {
  return apiList<TracingRecord>(withQuery(`/api/v1/tracing/customer/${customerId}`, {
    limit,
    offset: 0,
  }));
}

export function listCustomerTopProducts(customerId: number, limit = 10): Promise<CustomerTopProduct[]> {
  return apiList<CustomerTopProduct>(withQuery(`/api/v1/customers/${customerId}/top-products`, {
    limit,
    offset: 0,
  }));
}

export function getOrdersPage(params: OrderListParams = {}): Promise<ApiListResponse<Order>> {
  return apiFetch<ApiListResponse<Order>>(withQuery("/api/v1/orders", {
    search: params.search,
    customer_id: params.customer_id,
    sales_representative_id: params.sales_representative_id,
    status: params.status,
    origin_channel: params.origin_channel,
    origin_platform: params.origin_platform,
    payment_method: params.payment_method,
    invoice_number: params.invoice_number,
    has_observations: params.has_observations,
    date_from: params.date_from,
    date_to: params.date_to,
    min_total: params.min_total,
    max_total: params.max_total,
    sort_by: params.sort_by,
    sort_dir: params.sort_dir,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  }));
}

export function getOrder(orderId: number): Promise<Order> {
  return apiDetail<Order>(`/api/v1/orders/${orderId}`);
}

export function getOrderFilterOptions(): Promise<OrderFilterOptions> {
  return apiDetail<OrderFilterOptions>("/api/v1/orders/filter-options");
}

/** Fetches one page from /api/v1/customers-map (only records with coordinates). */
export async function getMapCustomersBatch(offset: number): Promise<CustomerRecord[]> {
  const qs = new URLSearchParams({ limit: "2000", offset: String(offset) });
  const res = await apiFetch<ApiListResponse<CustomerRecord>>(`/api/v1/customers-map?${qs}`);
  return listResults(res);
}

// Commercial domain: laboratories + plans
export interface Laboratory {
  id: string;
  external_brand_id: number | null;
  erp_code: string | null;
  name: string;
  tax_id: string | null;
  logo_url: string | null;
  brand_color: string | null;
  annual_goal: number | null;
  created_at: string;
}

export interface SupabaseBrand {
  id: number;
  name: string | null;
  type?: string | null;
  code?: string | null;
  trained?: boolean | null;
  is_verified?: boolean | null;
  required_product_fields?: unknown;
  [key: string]: unknown;
}

export interface SupabaseProduct {
  id: number;
  product_commercial_name?: string | null;
  product_brand_name?: string | null;
  product_category?: string | null;
  product_presentation?: string | null;
  product_active_ingredient?: string | null;
  product_is_catalog_verified?: boolean | null;
  image_path?: string | null;
  [key: string]: unknown;
}

export interface ProductCatalogItem {
  product_sku: string;
  product_commercial_name?: string | null;
  product_brand_name?: string | null;
  external_product_id?: string | null;
  image_url?: string | null;
  product_industry_sector?: string | null;
  product_category?: string | null;
  product_line_name?: string | null;
  product_target_animal_species?: string | null;
  product_technical_description?: string | null;
  product_unit_of_measurement?: string | null;
  product_substitute_skus?: unknown;
  product_recommended_application_frequency?: string | null;
  metadata?: unknown;
  product_is_catalog_verified?: boolean | null;
  product_is_discontinued?: boolean | null;
  inventory_id?: number | null;
  distributor_id?: number | null;
  total_units_available?: number | null;
  inventory_locations_count?: number | null;
  max_units_in_single_inventory?: number | null;
  ordered_quantity?: number | null;
  committed_quantity?: number | null;
  maximal_stock?: number | null;
  minimal_stock?: number | null;
  min_unit_sale_price?: number | null;
  max_unit_sale_price?: number | null;
  avg_unit_sale_price?: number | null;
  inventories?: ProductInventoryLocation[];
  price_lists_count?: number | null;
  price_lists?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface ProductInventoryLocation {
  inventory_id?: number | null;
  warehouse_code?: string | null;
  in_stock?: number | null;
  ordered_quantity?: number | null;
  committed_quantity?: number | null;
  maximal_stock?: number | null;
  minimal_stock?: number | null;
  standard_average_price?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductFilterOptions {
  brands: string[];
  sectors: string[];
  categories: string[];
  species: string[];
}

export interface ProductListParams {
  sku?: string;
  search?: string;
  brand_name?: string;
  external_brand_id?: number;
  category?: string;
  industry_sector?: string;
  line_name?: string;
  target_species?: string;
  is_catalog_verified?: boolean;
  is_discontinued?: boolean;
  has_inventory?: boolean;
  in_stock_only?: boolean;
  min_units?: number;
  max_units?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface InventoryItem {
  id: number;
  inventory_id?: number | null;
  distributor_id: number;
  product_catalog_code: string;
  units_available_in_stock: number;
  product_commercial_name?: string | null;
  product_brand_name?: string | null;
  product_category?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface InventoryListParams {
  sku?: string;
  search?: string;
  brand_name?: string;
  category?: string;
  in_stock_only?: boolean;
  min_units?: number;
  max_units?: number;
  limit?: number;
  offset?: number;
}

export interface LaboratoryPayload {
  external_brand_id: number;
  erp_code: string | null;
  tax_id?: string | null;
  logo_url: string | null;
  brand_color: string | null;
  annual_goal: number | null;
}

export interface SupabaseBrandListParams {
  search?: string;
  type?: string;
  is_verified?: boolean;
  trained?: boolean;
  limit?: number;
  offset?: number;
}

export interface PlanFund {
  id: string;
  plan_id: string;
  concept: string;
  amount_type: "fijo" | "porcentaje";
  amount_value: number | null;
  budget_period: string;
  current_balance: number;
}

export interface Plan {
  id: string;
  lab_id: string;
  laboratory_name?: string | null;
  year: number;
  name: string;
  status: "activo" | "negociacion" | "cerrado";
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  contract_pdf_url: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  total_purchase_goal: number | null;
  total_budget_allocated: number | null;
  created_at: string;
  updated_at: string;
  funds?: PlanFund[];
}

export interface PlanFundPayload {
  id?: string;
  concept: string;
  amount_type: "fijo" | "porcentaje";
  amount_value: number | null;
  budget_period?: string;
}

export interface PlanPayload {
  lab_id: string;
  year: number;
  name?: string;
  status?: "activo" | "negociacion" | "cerrado";
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  contract_pdf_url?: string | null;
  ai_extracted_data?: Record<string, unknown> | null;
  total_purchase_goal: number | null;
  funds: PlanFundPayload[];
}

export type PromoStatus = "borrador" | "revision" | "aprobada" | "activa" | "pausada" | "finalizada" | "cancelada";
export type SourceRole = "laboratorio" | "distribuidor" | "admin";
export type WalletTxType = "deposito_plan" | "ajuste_manual" | "reserva_promo" | "gasto_real" | "reintegro_no_usado";
export type PromotionTargetScope = "all" | "customers" | "customer_segment" | "product_filters";
export type PromotionType =
  | "descuento_linea"
  | "bonificacion_cantidad"
  | "precio_especial"
  | "descuento_volumen"
  | "bonificacion_volumen"
  | "combo";
export type MechanicConditionType = "none" | "minimum_amount" | "minimum_quantity" | "product_mix";
export type MechanicBenefitType = "percentage_discount" | "fixed_discount" | "bonus_product" | "bonus_units" | "special_price";
export type DiscountType = "percentage" | "fixed";
export type BonusProductType = "same_product" | "different_product";
export type BundleRule = "all_required" | "any_required";

export interface RequiredPromotionProduct {
  product_id: string;
  minimum_quantity: number | null;
  product_name?: string | null;
}

export interface PromotionMechanicData {
  condition_type?: MechanicConditionType | null;
  benefit_type?: MechanicBenefitType | null;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  special_price?: number | null;
  special_price_product_id?: string | null;
  special_price_product_name?: string | null;
  base_product_id?: string | null;
  base_product_name?: string | null;
  base_quantity?: number | null;
  bonus_quantity?: number | null;
  bonus_product_type?: BonusProductType | null;
  bonus_product_id?: string | null;
  bonus_product_name?: string | null;
  minimum_amount?: number | null;
  minimum_quantity?: number | null;
  bundle_rule?: BundleRule | null;
  required_products?: RequiredPromotionProduct[];
}

export interface PromoMechanic {
  promotion_type?: PromotionType | string | null;
  promotion_type_label?: string | null;
  condition_type?: string | null;
  condition_type_label?: string | null;
  benefit_type?: MechanicBenefitType | string | null;
  benefit_type_label?: string | null;
  mechanic?: PromotionMechanicData | null;
  summary?: string | null;
  accounting_treatment?: string | null;
}

export interface Promotion {
  id: string;
  lab_id: string;
  laboratory_name?: string | null;
  created_by_role: SourceRole;
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: PromoStatus;
  estimated_cost: number | null;
  max_redemptions: number | null;
  current_redemptions: number;
  product_mode?: string;
  product_skus?: string[];
  product_filters?: Record<string, string>;
  audience_scope?: PromotionTargetScope;
  customer_ids?: string[];
  customer_filters?: Record<string, unknown> | null;
  origin?: string | null;
  flash_card_url: string | null;
  marketing_copy: string | null;
  created_at: string;
  mechanic?: PromoMechanic | null;
  budget_summary?: PromotionBudgetSummary;
  requires_manager_approval?: boolean;
  sap_campaign_number?: number | null;
  sap_sync_error?: string | null;
  sap_synced_at?: string | null;
}

export interface PromotionBudgetSummary {
  lab_id: string;
  spendable_balance: number;
  base_spendable_budget: number;
  committed_amount: number;
  positive_adjustments: number;
  negative_adjustments: number;
}

export interface BudgetRule {
  id: string;
  concept_key: string;
  label: string;
  is_budget_source: boolean;
  created_at: string;
}

export interface WalletLedger {
  id: string;
  lab_id: string;
  plan_id: string | null;
  promo_id: string | null;
  transaction_type: WalletTxType;
  amount: number;
  description: string | null;
  transaction_date: string;
  reconciled_with_erp: boolean;
  erp_doc_num: string | null;
}

export interface WalletSummary {
  base_spendable_budget: number;
  positive_adjustments: number;
  negative_adjustments: number;
  committed_amount: number;
  available_balance: number;
  utilization_percent: number;
}

export interface WalletLedgerEntry {
  id: string;
  type: "ingreso" | "egreso";
  concept: string;
  amount: number;
  date: string;
  source: string;
  category: "plan" | "promo" | "ajuste";
}

export interface LaboratoryWalletView {
  laboratory: Pick<Laboratory, "id" | "name">;
  summary: WalletSummary;
  ledger_entries: WalletLedgerEntry[];
  flags: {
    is_negative_balance: boolean;
  };
}

export interface WalletAdjustmentPayload {
  type: "ingreso" | "egreso";
  amount: number;
  description: string;
  transaction_date: string;
}

export interface DashboardKpis {
  total_budget_managed: number;
  active_promotions_count: number;
  total_promotions_count: number;
  total_committed: number;
  execution_percentage: number;
  active_plans_count: number;
}

export interface DashboardExpiringPromotion {
  id: string;
  title: string;
  lab_id: string;
  laboratory_name: string | null;
  created_by_role?: SourceRole;
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  end_date: string;
  days_left: number;
  status: PromoStatus;
}

export interface DashboardCriticalLaboratory {
  lab_id: string;
  lab_name: string;
  available_balance: number;
  percentage: number;
  budget: number;
  committed: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  expiring_promotions: DashboardExpiringPromotion[];
  critical_laboratories: DashboardCriticalLaboratory[];
  generated_at: string;
}

export interface CalendarPromotion {
  id: string;
  title: string;
  lab_id: string;
  laboratory_name: string | null;
  created_by_role?: SourceRole;
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  start_date: string;
  end_date: string;
  status: PromoStatus;
  estimated_cost: number;
  mechanic: PromoMechanic | null;
  derived_category: string;
  has_conflict: boolean;
  conflict_with: string[];
}

export interface AiGenerateRequest {
  model: string;
  system_prompt: string;
  user_input: string;
  temperature?: number;
  max_output_tokens?: number;
  input_files?: Array<{
    filename: string;
    mime_type: string;
    data_base64: string;
  }>;
}

export interface AiGenerateResponse {
  model: string;
  text: string;
}

export interface MarketingFlashcardResponse {
  promotion_id: string;
  flash_card_url: string;
  marketing_copy: string | null;
}

export interface PromoExecution {
  id: string;
  erp_order_id: string | null;
  cost_impact: number | null;
  execution_date: string;
  is_billed_to_lab: boolean;
  promo_id: string | null;
  customer_id: string | null;
  promo_title: string | null;
  customer_name: string | null;
  customer_nit: string | null;
  product_sku: string | null;
  product_name: string | null;
}

export interface PromoExecutionSimulationResult {
  execution: PromoExecution;
  triggered: boolean;
  description: string;
  erp_order_id: string;
}

export interface ActivePromotionExecutionView {
  id: string;
  title: string;
  lab_id: string;
  laboratory_name: string | null;
  created_by_role?: SourceRole;
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  mechanic: PromoMechanic | null;
}

export interface NotificationItem {
  id: string;
  notification_key: string;
  title: string;
  message: string;
  level: "info" | "warning" | "critical";
  route: string;
  created_at: string;
  is_read: boolean;
}

export interface NotificationsSummary {
  items: NotificationItem[];
  unread_count: number;
}

export interface LaboratoryListParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PlanListParams {
  search?: string;
  status?: Plan["status"];
  lab_id?: string;
  year?: number;
  limit?: number;
  offset?: number;
}

export interface PromotionListParams {
  search?: string;
  status?: PromoStatus;
  lab_id?: string;
  created_by_role?: SourceRole;
  start_date_from?: string;
  start_date_to?: string;
  limit?: number;
  offset?: number;
}

export interface CalendarPromotionListParams {
  search?: string;
  status?: PromoStatus;
  lab_id?: string;
  category?: string;
  start_date_from?: string;
  start_date_to?: string;
  limit?: number;
  offset?: number;
}

export interface PromoExecutionListParams {
  search?: string;
  lab_id?: string;
  promo_id?: string;
  is_billed_to_lab?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface PromoMechanicPayload {
  promotion_type?: PromotionType | string | null;
  condition_type?: string | null;
  condition_config?: Record<string, unknown> | null;
  benefit_type?: MechanicBenefitType | string | null;
  reward_type?: string | null;
  reward_config?: Record<string, unknown> | null;
  mechanic?: PromotionMechanicData | null;
  accounting_treatment?: string | null;
}

export interface PromotionPayload {
  lab_id: string;
  created_by_role?: SourceRole;
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  status?: PromoStatus;
  estimated_cost?: number | null;
  max_redemptions?: number | null;
  target_segment?: Record<string, unknown> | null;
  product_skus: string[];
  product_application_mode?: string;
  product_filters?: Record<string, unknown>;
  target_scope: PromotionTargetScope;
  target_config: Record<string, unknown>;
  customer_ids?: string[];
  customer_filters?: Record<string, unknown> | null;
  origin?: string | null;
  flash_card_url?: string | null;
  marketing_copy?: string | null;
  mechanic: PromoMechanicPayload;
}

export interface PromotionImportRowPayload {
  laboratory: string;
  title: string;
  origin?: string | null;
  start_date: string;
  end_date: string;
  sku: string;
  tipo_mecanica: string;
  base_cantidad?: number | null;
  bonus_cantidad?: number | null;
  porcentaje_descuento?: number | null;
  alcance?: string | null;
  clientes?: string | null;
}

export function listProducts(params: ProductListParams = {}): Promise<ProductCatalogItem[]> {
  return apiList<ProductCatalogItem>(withQuery("/api/v1/products", {
    sku: params.sku,
    search: params.search,
    brand_name: params.brand_name,
    external_brand_id: params.external_brand_id,
    category: params.category,
    industry_sector: params.industry_sector,
    line_name: params.line_name,
    target_species: params.target_species,
    is_catalog_verified: params.is_catalog_verified,
    is_discontinued: params.is_discontinued,
    has_inventory: params.has_inventory,
    in_stock_only: params.in_stock_only,
    min_units: params.min_units,
    max_units: params.max_units,
    sort_by: params.sort_by,
    sort_dir: params.sort_dir,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  }));
}

export function getProductsPage(params: ProductListParams = {}): Promise<ApiListResponse<ProductCatalogItem>> {
  return apiFetch<ApiListResponse<ProductCatalogItem>>(withQuery("/api/v1/products", {
    sku: params.sku,
    search: params.search,
    brand_name: params.brand_name,
    category: params.category,
    industry_sector: params.industry_sector,
    line_name: params.line_name,
    target_species: params.target_species,
    is_catalog_verified: params.is_catalog_verified,
    is_discontinued: params.is_discontinued,
    has_inventory: params.has_inventory,
    in_stock_only: params.in_stock_only,
    min_units: params.min_units,
    max_units: params.max_units,
    sort_by: params.sort_by,
    sort_dir: params.sort_dir,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  }));
}

export function getProductFilterOptions(): Promise<ProductFilterOptions> {
  return apiDetail<ProductFilterOptions>("/api/v1/products/filter-options");
}

// ─── In-memory TTL cache shared across all callers ───────────────────────────
const CATALOG_TTL_MS = 30 * 60 * 1000; // 30 minutes
let _allProductsCache: ProductCatalogItem[] | null = null;
let _allProductsCachedAt = 0;
let _allProductsInflight: Promise<ProductCatalogItem[]> | null = null;

let _allCustomersCache: CustomerRecord[] | null = null;
let _allCustomersCachedAt = 0;
let _allCustomersInflight: Promise<CustomerRecord[]> | null = null;

export async function getAllProducts(): Promise<ProductCatalogItem[]> {
  if (_allProductsCache && Date.now() - _allProductsCachedAt < CATALOG_TTL_MS) {
    return _allProductsCache;
  }
  if (_allProductsInflight) return _allProductsInflight;
  _allProductsInflight = (async () => {
    const PAGE = 1000;
    const first = await getProductsPage({ limit: PAGE, offset: 0, sort_by: 'sku', sort_dir: 'asc' });
    const total = first.meta?.count ?? first.data.length;
    const results: ProductCatalogItem[] = [...first.data];
    const pages = Math.ceil(total / PAGE);
    if (pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) =>
          getProductsPage({ limit: PAGE, offset: (i + 1) * PAGE, sort_by: 'sku', sort_dir: 'asc' })
        )
      );
      for (const res of rest) results.push(...res.data);
    }
    _allProductsCache = results;
    _allProductsCachedAt = Date.now();
    _allProductsInflight = null;
    return results;
  })();
  return _allProductsInflight;
}

export async function getAllCustomers(): Promise<CustomerRecord[]> {
  if (_allCustomersCache && Date.now() - _allCustomersCachedAt < CATALOG_TTL_MS) {
    return _allCustomersCache;
  }
  if (_allCustomersInflight) return _allCustomersInflight;
  _allCustomersInflight = (async () => {
    const PAGE = 1000;
    const first = await getCustomersPage({ limit: PAGE, offset: 0 });
    const total = first.meta?.count ?? first.data.length;
    const results: CustomerRecord[] = [...first.data];
    const pages = Math.ceil(total / PAGE);
    if (pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) =>
          getCustomersPage({ limit: PAGE, offset: (i + 1) * PAGE })
        )
      );
      for (const res of rest) results.push(...res.data);
    }
    _allCustomersCache = results;
    _allCustomersCachedAt = Date.now();
    _allCustomersInflight = null;
    return results;
  })();
  return _allCustomersInflight;
}

export function invalidateAllProductsCache(): void {
  _allProductsCache = null;
  _allProductsCachedAt = 0;
}

export function invalidateAllCustomersCache(): void {
  _allCustomersCache = null;
  _allCustomersCachedAt = 0;
}

export interface ProductLightItem {
  product_sku: string;
  product_commercial_name?: string | null;
}

export function searchProductsLight(search: string): Promise<ApiListResponse<ProductLightItem>> {
  return apiFetch<ApiListResponse<ProductLightItem>>(
    withQuery("/api/v1/catalog/search", { q: search, limit: 20, offset: 0 })
  );
}

export function getProduct(sku: string): Promise<ProductCatalogItem> {
  return apiDetail<ProductCatalogItem>(`/api/v1/products/${encodeURIComponent(sku)}`);
}

export function getSupabaseProduct(productId: number): Promise<SupabaseProduct> {
  return apiDetail<SupabaseProduct>(`/api/v1/supabase/products/${productId}`);
}

export function listInventory(params: InventoryListParams = {}): Promise<InventoryItem[]> {
  return apiList<InventoryItem>(withQuery("/api/v1/inventory", {
    sku: params.sku,
    search: params.search,
    brand_name: params.brand_name,
    category: params.category,
    in_stock_only: params.in_stock_only,
    min_units: params.min_units,
    max_units: params.max_units,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  }));
}

export function updateInventoryItem(inventoryId: number, units_available_in_stock: number): Promise<InventoryItem> {
  return apiDetail<InventoryItem>(`/api/v1/inventory/${inventoryId}`, {
    method: "PATCH",
    body: JSON.stringify({ units_available_in_stock }),
  });
}

export function listSupabaseBrands(params: SupabaseBrandListParams = {}): Promise<SupabaseBrand[]> {
  return apiList<SupabaseBrand>(withQuery("/api/v1/supabase/brands", {
    search: params.search,
    type: params.type,
    is_verified: params.is_verified,
    trained: params.trained,
    limit: params.limit ?? 1000,
    offset: params.offset ?? 0,
  }));
}

export function listLaboratories(params: LaboratoryListParams = {}): Promise<Laboratory[]> {
  return apiList<Laboratory>(withQuery("/api/v1/laboratories", {
    search: params.search,
    limit: params.limit ?? 500,
    offset: params.offset ?? 0,
  }));
}

export function createLaboratory(payload: LaboratoryPayload): Promise<Laboratory> {
  return apiDetail<Laboratory>("/api/v1/laboratories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLaboratory(id: string, payload: Partial<LaboratoryPayload>): Promise<Laboratory> {
  return apiDetail<Laboratory>(`/api/v1/laboratories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteLaboratory(id: string): Promise<void> {
  await apiDetail<Laboratory>(`/api/v1/laboratories/${id}`, { method: "DELETE" });
}

export function listPlans(params: PlanListParams = {}): Promise<Plan[]> {
  return apiList<Plan>(withQuery("/api/v1/plans", {
    search: params.search,
    status: params.status,
    lab_id: params.lab_id,
    year: params.year,
    limit: params.limit ?? 500,
    offset: params.offset ?? 0,
  }));
}

export function getPlan(id: string): Promise<Plan> {
  return apiDetail<Plan>(`/api/v1/plans/${id}`);
}

export function createPlan(payload: PlanPayload): Promise<Plan> {
  return apiDetail<Plan>("/api/v1/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlan(id: string, payload: Partial<PlanPayload>): Promise<Plan> {
  return apiDetail<Plan>(`/api/v1/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePlanStatus(id: string, status: Plan["status"]): Promise<Plan> {
  return apiDetail<Plan>(`/api/v1/plans/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deletePlan(id: string): Promise<void> {
  await apiDetail<Plan>(`/api/v1/plans/${id}`, { method: "DELETE" });
}

export function uploadPlanContract(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{ url: string }>("/api/v1/plans/upload-contract", {
    method: "POST",
    body: form,
  });
}

export function listPromotions(params: PromotionListParams = {}): Promise<Promotion[]> {
  return apiList<Promotion>(withQuery("/api/v1/promotions", {
    search: params.search,
    status: params.status,
    lab_id: params.lab_id,
    created_by_role: params.created_by_role,
    start_date_from: params.start_date_from,
    start_date_to: params.start_date_to,
    limit: params.limit ?? 500,
    offset: params.offset ?? 0,
  }));
}

export function getPromotion(id: string): Promise<Promotion> {
  return apiDetail<Promotion>(`/api/v1/promotions/${id}`);
}

export function createPromotion(payload: PromotionPayload): Promise<Promotion> {
  return apiDetail<Promotion>("/api/v1/promotions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePromotion(id: string, payload: Partial<PromotionPayload>): Promise<Promotion> {
  return apiDetail<Promotion>(`/api/v1/promotions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePromotionStatus(id: string, status: PromoStatus): Promise<Promotion> {
  return apiDetail<Promotion>(`/api/v1/promotions/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function clonePromotion(id: string): Promise<Promotion> {
  return apiDetail<Promotion>(`/api/v1/promotions/${id}/clone`, { method: "POST" });
}

export async function deletePromotion(id: string): Promise<void> {
  await apiDetail<Promotion>(`/api/v1/promotions/${id}`, { method: "DELETE" });
}

export interface BulkActionResultItem {
  id: string;
  success: boolean;
  error: string | null;
}

export interface BulkActionResponse {
  results: BulkActionResultItem[];
  success_count: number;
  failure_count: number;
}

export function bulkUpdatePromotionStatus(ids: string[], status: PromoStatus): Promise<BulkActionResponse> {
  return apiFetch<BulkActionResponse>('/api/v1/promotions/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, status }),
  });
}

export function bulkDeletePromotions(ids: string[]): Promise<BulkActionResponse> {
  return apiFetch<BulkActionResponse>('/api/v1/promotions/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function importPromotions(rows: PromotionImportRowPayload[]): Promise<{ imported_count: number; skipped_count: number; errors: string[] }> {
  return apiDetail<{ imported_count: number; skipped_count: number; errors: string[] }>("/api/v1/promotions/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export interface SapMessage {
  type: "info" | "warning" | "error";
  text: string;
}

export interface SapCampaignPreview {
  campaign_number: number;
  title: string;
  laboratory_name: string | null;
  start_date: string;
  end_date: string;
  status: PromoStatus;
  action: "create" | "update";
  messages: SapMessage[];
}

export interface SapImportResult {
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  errors: string[];
}

export interface SapHealthStatus {
  status: "ok" | "unavailable" | "disabled";
  latency_ms: number;
}

export interface SapErrorInfo {
  error_type: "TIMEOUT" | "NETWORK_ERROR" | "SAP_UNAVAILABLE" | "AUTH_EXPIRED" | "DATA_ERROR" | "UNKNOWN";
  is_retryable: boolean;
  message: string;
}

export function inferSapErrorType(error: unknown): SapErrorInfo {
  if (error instanceof ApiError) {
    if (error.status === 504) return { error_type: "TIMEOUT", is_retryable: true, message: error.message };
    if (error.status >= 500) return { error_type: "SAP_UNAVAILABLE", is_retryable: true, message: error.message };
    if (error.status === 401) return { error_type: "AUTH_EXPIRED", is_retryable: true, message: error.message };
    return { error_type: "DATA_ERROR", is_retryable: false, message: error.message };
  }
  return { error_type: "NETWORK_ERROR", is_retryable: true, message: String(error) };
}

export function checkSapHealth(): Promise<SapHealthStatus> {
  return apiFetch<SapHealthStatus>("/api/v1/sap-sync/campaigns/from-sap/health");
}

export function previewSapCampaigns(): Promise<SapCampaignPreview[]> {
  return apiList<SapCampaignPreview>("/api/v1/sap-sync/campaigns/from-sap/preview");
}

export function importSapCampaigns(campaignNumbers: number[]): Promise<SapImportResult> {
  return apiDetail<SapImportResult>("/api/v1/sap-sync/campaigns/from-sap/import", {
    method: "POST",
    body: JSON.stringify({ campaign_numbers: campaignNumbers }),
  });
}

export interface SapAutoSyncStatus {
  status: "ok" | "errors" | "failed" | "never_run";
  last_run_at: string | null;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function getSapAutoSyncStatus(): Promise<SapAutoSyncStatus> {
  return apiFetch<SapAutoSyncStatus>("/api/v1/sap-sync/campaigns/auto-status");
}

export function getPromotionBudget(labId: string, excludePromoId?: string): Promise<PromotionBudgetSummary> {
  const qs = new URLSearchParams();
  if (excludePromoId) qs.set("exclude_promo_id", excludePromoId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiDetail<PromotionBudgetSummary>(`/api/v1/laboratories/${labId}/promotion-budget${suffix}`);
}

export function listBudgetRules(): Promise<BudgetRule[]> {
  return apiList<BudgetRule>("/api/v1/budget-rules");
}

export function updateBudgetRule(conceptKey: string, is_budget_source: boolean): Promise<BudgetRule> {
  return apiDetail<BudgetRule>(`/api/v1/budget-rules/${conceptKey}`, {
    method: "PATCH",
    body: JSON.stringify({ is_budget_source }),
  });
}

export function getLaboratoryWallet(labId: string): Promise<LaboratoryWalletView> {
  return apiDetail<LaboratoryWalletView>(`/api/v1/laboratories/${labId}/wallet`);
}

export function createWalletAdjustment(labId: string, payload: WalletAdjustmentPayload): Promise<WalletLedger> {
  return apiDetail<WalletLedger>(`/api/v1/laboratories/${labId}/wallet/adjustments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiDetail<DashboardSummary>("/api/v1/dashboard/summary");
}

export function listCalendarPromotions(params: CalendarPromotionListParams = {}): Promise<CalendarPromotion[]> {
  return apiList<CalendarPromotion>(withQuery("/api/v1/calendar/promotions", {
    search: params.search,
    status: params.status,
    lab_id: params.lab_id,
    category: params.category,
    start_date_from: params.start_date_from,
    start_date_to: params.start_date_to,
    limit: params.limit ?? 500,
    offset: params.offset ?? 0,
  }));
}

export function listMarketingPromotions(params: PromotionListParams = {}): Promise<Promotion[]> {
  return apiList<Promotion>(withQuery("/api/v1/marketing/promotions", {
    search: params.search,
    status: params.status,
    lab_id: params.lab_id,
    limit: params.limit ?? 500,
    offset: params.offset ?? 0,
  }));
}

export function generateAiText(payload: AiGenerateRequest): Promise<AiGenerateResponse> {
  return apiDetail<AiGenerateResponse>("/api/v1/ai/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadMarketingFlashcard(
  id: string,
  file: Blob,
  filename: string,
  marketingCopy: string,
): Promise<MarketingFlashcardResponse> {
  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("marketing_copy", marketingCopy);
  return apiDetail<MarketingFlashcardResponse>(`/api/v1/promotions/${id}/marketing/flashcard`, {
    method: "POST",
    body: formData,
  });
}

export function listPromoExecutions(params: PromoExecutionListParams = {}): Promise<PromoExecution[]> {
  return apiList<PromoExecution>(withQuery("/api/v1/promo-executions", {
    search: params.search,
    lab_id: params.lab_id,
    promo_id: params.promo_id,
    is_billed_to_lab: params.is_billed_to_lab,
    date_from: params.date_from,
    date_to: params.date_to,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  }));
}

export function listActiveExecutionPromotions(params: Pick<PromoExecutionListParams, "search" | "lab_id" | "limit" | "offset"> = {}): Promise<ActivePromotionExecutionView[]> {
  return apiList<ActivePromotionExecutionView>(withQuery("/api/v1/promo-executions/active-promotions", {
    search: params.search,
    lab_id: params.lab_id,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  }));
}

export function simulatePromoExecution(): Promise<PromoExecutionSimulationResult> {
  return apiDetail<PromoExecutionSimulationResult>("/api/v1/promo-executions/simulate", {
    method: "POST",
  });
}

export function updatePromoExecutionBilled(id: string, is_billed_to_lab: boolean): Promise<PromoExecution> {
  return apiDetail<PromoExecution>(`/api/v1/promo-executions/${id}/billed`, {
    method: "PATCH",
    body: JSON.stringify({ is_billed_to_lab }),
  });
}

export function getNotifications(): Promise<NotificationsSummary> {
  return apiDetail<NotificationsSummary>("/api/v1/notifications");
}

export function markNotificationRead(notificationKey: string): Promise<{ notification_key: string; is_read: boolean }> {
  return apiDetail<{ notification_key: string; is_read: boolean }>(`/api/v1/notifications/${notificationKey}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<{ updated_count: number }> {
  return apiDetail<{ updated_count: number }>("/api/v1/notifications/read-all", {
    method: "POST",
  });
}

export interface NotificationPreference {
  notification_type: string;
  label: string;
  description: string;
  enabled: boolean;
}

export function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return apiFetch<NotificationPreference[]>("/api/v1/notifications/preferences");
}

export function updateNotificationPreference(
  notificationType: string,
  enabled: boolean,
): Promise<{ notification_type: string; enabled: boolean }> {
  return apiFetch<{ notification_type: string; enabled: boolean }>(
    `/api/v1/notifications/preferences/${notificationType}`,
    { method: "PUT", body: JSON.stringify({ enabled }) },
  );
}

// ── App Users (username/password auth) ────────────────────────────────────────

export interface AppUserRecord {
  id: number;
  username: string;
  role: 'superadmin' | 'supervisor' | 'sales_rep';
  phone?: string | null;
  distributor_id: number;
  sales_representative_id?: number | null;
  is_active: boolean;
  requires_otp: boolean;
}

export interface AppUserCreate {
  username: string;
  password: string;
  role: 'superadmin' | 'supervisor' | 'sales_rep';
  phone?: string | null;
  distributor_id?: number;
  sales_representative_id?: number | null;
  requires_otp?: boolean;
}

export interface AppUserUpdate {
  username?: string;
  password?: string;
  role?: 'superadmin' | 'supervisor' | 'sales_rep';
  phone?: string | null;
  distributor_id?: number;
  sales_representative_id?: number | null;
  is_active?: boolean;
  requires_otp?: boolean;
}

export interface AppUserFilters {
  search?: string;
  role?: string;
  is_active?: boolean;
  requires_otp?: boolean;
  has_phone?: boolean;
  order_by?: string;
}

export function listAppUsers(filters?: AppUserFilters): Promise<AppUserRecord[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.role) params.set('role', filters.role);
  if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));
  if (filters?.requires_otp !== undefined) params.set('requires_otp', String(filters.requires_otp));
  if (filters?.has_phone !== undefined) params.set('has_phone', String(filters.has_phone));
  if (filters?.order_by) params.set('order_by', filters.order_by);
  const qs = params.toString();
  return apiFetch<AppUserRecord[]>(`/api/v1/users${qs ? `?${qs}` : ''}`);
}

export function createAppUser(data: AppUserCreate): Promise<AppUserRecord> {
  return apiFetch<AppUserRecord>('/api/v1/users', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAppUser(id: number, data: AppUserUpdate): Promise<AppUserRecord> {
  return apiFetch<AppUserRecord>(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deactivateAppUser(id: number): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/api/v1/users/${id}`, { method: 'DELETE', headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? `Error ${res.status}`);
  }
}

// ── Stockouts ──────────────────────────────────────────────────────────────────

export interface Stockout {
  id: number;
  product_sku: string;
  product_name?: string | null;
  reason: string;
  notes?: string | null;
  sales_rep_id: number;
  sales_rep_name?: string | null;
  status: 'activo' | 'resuelto';
  reported_at: string;
  resolved_at?: string | null;
}

export interface StockoutCreate {
  product_sku: string;
  product_name?: string | null;
  reason: string;
  notes?: string | null;
}

export async function createStockout(data: StockoutCreate): Promise<Stockout> {
  return apiDetail<Stockout>('/api/v1/stockouts', { method: 'POST', body: JSON.stringify(data) });
}

export async function listStockouts(params?: { status?: string; limit?: number; offset?: number }): Promise<Stockout[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiDetail<Stockout[]>(`/api/v1/stockouts${query}`);
}

export async function resolveStockout(id: number): Promise<Stockout> {
  return apiDetail<Stockout>(`/api/v1/stockouts/${id}/resolve`, { method: 'PATCH' });
}

export async function deleteStockout(id: number): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/api/v1/stockouts/${id}`, { method: 'DELETE', headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? `Error ${res.status}`);
  }
}

// ── Promotor Transfers ─────────────────────────────────────────────────────────

export interface PromotorTransferItem {
  id: string;
  transfer_id: string;
  line_number: number;
  product_sku: string;
  product_name: string | null;
  quantity: number;
}

export interface PromotorTransfer {
  id: string;
  reference: string;
  promotor_id: number;
  promotor_name: string | null;
  sales_representative_id: number;
  sales_representative_name: string | null;
  sales_representative_brand_id: number | null;
  sales_representative_brand_name: string | null;
  brand_id: number | null;
  brand: string | null;
  distributor_id: number;
  customer_id: number | null;
  customer_name: string | null;
  status: "borrador" | "enviada" | "cancelada";
  observations: string | null;
  items: PromotorTransferItem[];
  created_at: string;
  updated_at: string;
}

export interface TransferListParams {
  status?: string;
  sales_representative_id?: number;
  promotor_id?: number;
  limit?: number;
  offset?: number;
}

export function listTransfers(params: TransferListParams = {}): Promise<PromotorTransfer[]> {
  return apiFetch<PromotorTransfer[]>(withQuery("/api/v1/promotor-transfers", {
    status: params.status,
    sales_representative_id: params.sales_representative_id,
    promotor_id: params.promotor_id,
    limit: params.limit ?? 1000,
    offset: params.offset ?? 0,
  }));
}

export function getTransfer(id: string): Promise<PromotorTransfer> {
  return apiFetch<PromotorTransfer>(`/api/v1/promotor-transfers/${id}`);
}

export function submitTransfer(id: string): Promise<PromotorTransfer> {
  return apiFetch<PromotorTransfer>(`/api/v1/promotor-transfers/${id}/submit`, { method: "PATCH" });
}

export function cancelTransfer(id: string): Promise<PromotorTransfer> {
  return apiFetch<PromotorTransfer>(`/api/v1/promotor-transfers/${id}/cancel`, { method: "PATCH" });
}
