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
// Actual API shape: { data: [...], meta: { limit, offset, count } }
interface ApiMeta { limit: number; offset: number; count: number; }
interface ApiListResponse<T> { data: T[]; meta: ApiMeta; }
interface ApiDetailResponse<T> { data: T; meta: { count?: number }; }

async function apiList<T>(path: string): Promise<T[]> {
  const res = await apiFetch<ApiListResponse<T>>(path);
  return res.data;
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
  limit?: number;
  offset?: number;
}

// Loosely typed — mapUtils validates and normalises each field.
export type CustomerRecord = Record<string, unknown>;

async function getCustomersPage(params: CustomerParams = {}): Promise<ApiListResponse<CustomerRecord>> {
  const qs = new URLSearchParams();
  if (params.search)        qs.set("search", params.search);
  if (params.business_type) qs.set("business_type", params.business_type);
  if (params.government_id) qs.set("government_id", params.government_id);
  qs.set("limit",  String(params.limit  ?? 100));
  qs.set("offset", String(params.offset ?? 0));
  return apiFetch<ApiListResponse<CustomerRecord>>(`/api/v1/customers?${qs}`);
}

/** Fetches one page from /api/v1/customers-map (only records with coordinates). */
export async function getMapCustomersBatch(offset: number): Promise<CustomerRecord[]> {
  const qs = new URLSearchParams({ limit: "2000", offset: String(offset) });
  const res = await apiFetch<ApiListResponse<CustomerRecord>>(`/api/v1/customers-map?${qs}`);
  return res?.data ?? [];
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
