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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
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

export function listLaboratories(): Promise<Laboratory[]> {
  return apiList<Laboratory>("/api/v1/laboratories?limit=500&offset=0");
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

export function listPlans(): Promise<Plan[]> {
  return apiList<Plan>("/api/v1/plans?limit=500&offset=0");
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

export function listPromotions(): Promise<Promotion[]> {
  return apiList<Promotion>("/api/v1/promotions?limit=500&offset=0");
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
