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
