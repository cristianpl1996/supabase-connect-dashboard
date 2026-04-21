// Types based on the SQL schema provided

export type PromoStatus = 'borrador' | 'revision' | 'aprobada' | 'activa' | 'pausada' | 'finalizada' | 'cancelada';
export type WalletTxType = 'deposito_plan' | 'ajuste_manual' | 'reserva_promo' | 'gasto_real' | 'reintegro_no_usado';
export type SourceRole = 'laboratorio' | 'distribuidor' | 'admin';

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

export interface Product {
  id: string;
  erp_sku: string;
  name: string;
  category: string | null;
  brand_id: string | null;
  current_stock: number;
  unit_cost: number | null;
  is_active: boolean;
}

export interface AnnualPlan {
  id: string;
  lab_id: string;
  laboratory_name?: string | null;
  year: number;
  name: string;
  status: 'activo' | 'negociacion' | 'cerrado';
  contract_pdf_url: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  total_purchase_goal: number | null;
  total_budget_allocated: number | null;
  created_at: string;
  updated_at: string;
  funds?: PlanFund[];
}

export interface PlanFund {
  id: string;
  plan_id: string;
  concept: string;
  amount_type: 'fijo' | 'porcentaje';
  amount_value: number | null;
  budget_period: string;
  current_balance: number;
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
  type: 'ingreso' | 'egreso';
  concept: string;
  amount: number;
  date: string;
  source: string;
  category: 'plan' | 'promo' | 'ajuste';
}

export interface LaboratoryWalletView {
  laboratory: Pick<Laboratory, 'id' | 'name'>;
  summary: WalletSummary;
  ledger_entries: WalletLedgerEntry[];
  flags: {
    is_negative_balance: boolean;
  };
}

export interface DashboardKpis {
  total_budget_managed: number;
  active_promotions_count: number;
  total_promotions_count: number;
  total_committed: number;
  execution_percentage: number;
  active_plans_count: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  expiring_promotions: Array<{
    id: string;
    title: string;
    lab_id: string;
    laboratory_name: string | null;
    end_date: string;
    days_left: number;
    status: PromoStatus;
  }>;
  critical_laboratories: Array<{
    lab_id: string;
    lab_name: string;
    available_balance: number;
    percentage: number;
    budget: number;
    committed: number;
  }>;
  generated_at: string;
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
  budget_summary?: {
    lab_id: string;
    spendable_balance: number;
    base_spendable_budget: number;
    committed_amount: number;
    positive_adjustments: number;
    negative_adjustments: number;
  };
  requires_manager_approval?: boolean;
}

export interface PromoMechanic {
  id: string;
  promo_id: string;
  condition_type: string | null;
  condition_config: Record<string, unknown> | null;
  reward_type: string | null;
  reward_config: Record<string, unknown> | null;
  accounting_treatment: string | null;
}

export interface PromoExecution {
  id: string;
  promo_id: string | null;
  sales_rep_id: string | null;
  customer_id: string | null;
  erp_order_id: string | null;
  cost_impact: number | null;
  execution_date: string;
  is_billed_to_lab: boolean;
}

export interface InventoryAlert {
  id: string;
  product_id: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_at_risk: number | null;
  status: string;
  suggested_promo_id: string | null;
  detected_at: string;
}
