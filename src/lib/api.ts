// ─── Base URL ─────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)
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
      window.dispatchEvent(new Event("ivanagro:unauthorized"));
    }
    throw new ApiError(res.status, message);
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
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export function login(credentials: LoginRequest): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
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
  government_id?: string;
  city?: string;
  state?: string;
  sales_representative_id?: number;
  has_location?: boolean;
  min_revenue?: number;
  max_revenue?: number;
  min_purchases?: number;
  max_purchases?: number;
  min_average_ticket?: number;
  max_average_ticket?: number;
  min_days_since_last_purchase?: number;
  max_days_since_last_purchase?: number;
  limit?: number;
  offset?: number;
}

// Loosely typed — mapUtils validates and normalises each field.
export type CustomerRecord = Record<string, unknown>;

export type SaleRecord = Record<string, unknown>;
export type TracingRecord = Record<string, unknown>;

export interface CustomerTopProduct {
  product_sku: string | null;
  product_commercial_name: string | null;
  product_brand_name: string | null;
  total_units: number | null;
  total_revenue: number | null;
  last_purchase_date: string | null;
}

export async function getCustomersPage(params: CustomerParams = {}): Promise<ApiListResponse<CustomerRecord>> {
  const qs = new URLSearchParams();
  if (params.search)        qs.set("search", params.search);
  if (params.business_type) qs.set("business_type", params.business_type);
  if (params.government_id) qs.set("government_id", params.government_id);
  if (params.city) qs.set("city", params.city);
  if (params.state) qs.set("state", params.state);
  if (params.sales_representative_id) qs.set("sales_representative_id", String(params.sales_representative_id));
  if (params.has_location !== undefined) qs.set("has_location", String(params.has_location));
  if (params.min_revenue !== undefined) qs.set("min_revenue", String(params.min_revenue));
  if (params.max_revenue !== undefined) qs.set("max_revenue", String(params.max_revenue));
  if (params.min_purchases !== undefined) qs.set("min_purchases", String(params.min_purchases));
  if (params.max_purchases !== undefined) qs.set("max_purchases", String(params.max_purchases));
  if (params.min_average_ticket !== undefined) qs.set("min_average_ticket", String(params.min_average_ticket));
  if (params.max_average_ticket !== undefined) qs.set("max_average_ticket", String(params.max_average_ticket));
  if (params.min_days_since_last_purchase !== undefined) qs.set("min_days_since_last_purchase", String(params.min_days_since_last_purchase));
  if (params.max_days_since_last_purchase !== undefined) qs.set("max_days_since_last_purchase", String(params.max_days_since_last_purchase));
  qs.set("limit",  String(params.limit  ?? 100));
  qs.set("offset", String(params.offset ?? 0));
  return apiFetch<ApiListResponse<CustomerRecord>>(`/api/v1/customers?${qs}`);
}

export async function listCustomers(params: CustomerParams = {}): Promise<CustomerRecord[]> {
  const res = await getCustomersPage(params);
  return listResults(res);
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

/** Fetches one page from /api/v1/customers-map (only records with coordinates). */
export async function getMapCustomersBatch(offset: number): Promise<CustomerRecord[]> {
  const qs = new URLSearchParams({ limit: "2000", offset: String(offset) });
  const res = await apiFetch<ApiListResponse<CustomerRecord>>(`/api/v1/customers-map?${qs}`);
  return listResults(res);
}

// Commercial domain: laboratories + plans
export interface Laboratory {
  id: string;
  erp_code: string | null;
  name: string;
  tax_id: string | null;
  logo_url: string | null;
  brand_color: string | null;
  annual_goal: number | null;
  created_at: string;
}

export interface ProductCatalogItem {
  product_sku: string;
  product_commercial_name?: string | null;
  product_brand_name?: string | null;
  product_industry_sector?: string | null;
  product_category?: string | null;
  product_line_name?: string | null;
  product_target_species?: string | null;
  product_target_animal_species?: string | null;
  product_technical_description?: string | null;
  product_unit_of_measurement?: string | null;
  product_substitute_skus?: unknown;
  product_recommended_application_frequency?: string | null;
  metadata?: unknown;
  is_catalog_verified?: boolean | null;
  is_discontinued?: boolean | null;
  product_is_catalog_verified?: boolean | null;
  product_is_discontinued?: boolean | null;
  inventory_id?: number | null;
  distributor_id?: number | null;
  units_available_in_stock?: number | null;
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
  min_standard_average_price?: number | null;
  max_standard_average_price?: number | null;
  avg_standard_average_price?: number | null;
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
  source_metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductListParams {
  sku?: string;
  search?: string;
  brand_name?: string;
  category?: string;
  line_name?: string;
  target_species?: string;
  is_catalog_verified?: boolean;
  is_discontinued?: boolean;
  has_inventory?: boolean;
  in_stock_only?: boolean;
  min_units?: number;
  max_units?: number;
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
  erp_code: string | null;
  name: string;
  tax_id?: string | null;
  logo_url: string | null;
  brand_color: string | null;
  annual_goal: number | null;
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
  contract_pdf_url?: string | null;
  ai_extracted_data?: Record<string, unknown> | null;
  total_purchase_goal: number | null;
  funds: PlanFundPayload[];
}

export type PromoStatus = "borrador" | "revision" | "aprobada" | "activa" | "pausada" | "finalizada" | "cancelada";
export type SourceRole = "laboratorio" | "distribuidor" | "admin";
export type WalletTxType = "deposito_plan" | "ajuste_manual" | "reserva_promo" | "gasto_real" | "reintegro_no_usado";
export type PromotionTargetScope = "all" | "customers" | "customer_segment" | "product_filters";

export interface PromoMechanic {
  id: string;
  promo_id: string;
  condition_type: string | null;
  condition_config: Record<string, unknown> | null;
  reward_type: string | null;
  reward_config: Record<string, unknown> | null;
  accounting_treatment: string | null;
}

export interface Promotion {
  id: string;
  lab_id: string;
  laboratory_name?: string | null;
  created_by_role: SourceRole;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: PromoStatus;
  estimated_cost: number | null;
  max_redemptions: number | null;
  current_redemptions: number;
  target_segment: Record<string, unknown> | null;
  product_skus?: string[];
  target_scope?: PromotionTargetScope;
  target_config?: Record<string, unknown>;
  flash_card_url: string | null;
  marketing_copy: string | null;
  created_at: string;
  mechanic?: PromoMechanic | null;
  budget_summary?: PromotionBudgetSummary;
  requires_manager_approval?: boolean;
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
  start_date: string;
  end_date: string;
  status: PromoStatus;
  estimated_cost: number;
  mechanic: PromoMechanic | null;
  derived_category: string;
  has_conflict: boolean;
  conflict_with: string[];
}

export interface MarketingCopyResponse {
  promotion_id: string;
  marketing_copy: string;
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
  condition_type: string | null;
  condition_config: Record<string, unknown> | null;
  reward_type: string | null;
  reward_config: Record<string, unknown> | null;
  accounting_treatment: string | null;
}

export interface PromotionPayload {
  lab_id: string;
  created_by_role?: SourceRole;
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  status?: PromoStatus;
  estimated_cost?: number | null;
  max_redemptions?: number | null;
  target_segment?: Record<string, unknown> | null;
  product_skus: string[];
  target_scope: PromotionTargetScope;
  target_config: Record<string, unknown>;
  flash_card_url?: string | null;
  marketing_copy?: string | null;
  mechanic: PromoMechanicPayload;
}

export interface PromotionImportRowPayload {
  laboratory: string;
  title: string;
  sku_condition?: string | null;
  quantity_condition?: number | null;
  benefit_type?: string | null;
  benefit_value?: number | null;
}

export function listProducts(params: ProductListParams = {}): Promise<ProductCatalogItem[]> {
  return apiList<ProductCatalogItem>(withQuery("/api/v1/products", {
    sku: params.sku,
    search: params.search,
    brand_name: params.brand_name,
    category: params.category,
    line_name: params.line_name,
    target_species: params.target_species,
    is_catalog_verified: params.is_catalog_verified,
    is_discontinued: params.is_discontinued,
    has_inventory: params.has_inventory,
    in_stock_only: params.in_stock_only,
    min_units: params.min_units,
    max_units: params.max_units,
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
    line_name: params.line_name,
    target_species: params.target_species,
    is_catalog_verified: params.is_catalog_verified,
    is_discontinued: params.is_discontinued,
    has_inventory: params.has_inventory,
    in_stock_only: params.in_stock_only,
    min_units: params.min_units,
    max_units: params.max_units,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  }));
}

export function getProduct(sku: string): Promise<ProductCatalogItem> {
  return apiDetail<ProductCatalogItem>(`/api/v1/products/${encodeURIComponent(sku)}`);
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

export async function importPromotions(rows: PromotionImportRowPayload[]): Promise<{ imported_count: number; skipped_count: number; errors: string[] }> {
  return apiDetail<{ imported_count: number; skipped_count: number; errors: string[] }>("/api/v1/promotions/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
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

export function generateMarketingCopy(id: string): Promise<MarketingCopyResponse> {
  return apiDetail<MarketingCopyResponse>(`/api/v1/promotions/${id}/marketing/copy`, {
    method: "POST",
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
