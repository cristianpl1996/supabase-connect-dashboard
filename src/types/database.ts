// Types based on the SQL schema provided

export type PromoStatus = 'borrador' | 'revision' | 'aprobada' | 'activa' | 'pausada' | 'finalizada' | 'cancelada';
export type WalletTxType = 'deposito_plan' | 'ajuste_manual' | 'reserva_promo' | 'gasto_real' | 'reintegro_no_usado';
export type SourceRole = 'laboratorio' | 'distribuidor' | 'admin';
export type PromotionTargetScope = 'all' | 'customers' | 'customer_segment' | 'product_filters';
export type PromotionType = 'descuento_linea' | 'bonificacion_cantidad' | 'precio_especial' | 'descuento_volumen' | 'bonificacion_volumen' | 'combo';
export type MechanicConditionType = 'none' | 'minimum_amount' | 'minimum_quantity' | 'product_mix';
export type MechanicBenefitType = 'percentage_discount' | 'fixed_discount' | 'bonus_product' | 'bonus_units' | 'special_price';
export type DiscountType = 'percentage' | 'fixed';
export type BonusProductType = 'same_product' | 'different_product';
export type BundleRule = 'all_required' | 'any_required';

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

export interface Product {
  id: string;
  erp_sku: string;
  name: string;
  category: string | null;
  brand_id: string | null;
  external_product_id?: string | null;
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
  validity_start_date: string;
  validity_end_date: string;
  parent_plan_id: string | null;
  extraction_status: 'no_document' | 'pending_review' | 'approved' | 'rejected';
  extraction_confidence: number | null;
  notes: string | null;
  created_by_identifier?: string | null;
  created_by_responsible?: string | null;
  created_by_brand?: string | null;
  contract_pdf_url: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  review_draft_data?: Record<string, unknown> | null;
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
  settlement_frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  payment_method: 'credit_note' | 'product' | 'rotation_boost_note' | 'invoice' | 'mixed';
  product_exclusions: string | null;
  compliance_threshold_pct: number;
  allows_carryover: boolean;
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
    created_by_role?: SourceRole;
    created_by_identifier?: string | null;
    created_by_responsible?: string | null;
    created_by_brand?: string | null;
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
  origin?: string | null;
  sap_campaign_number?: number | null;
  sap_sync_error?: string | null;
  sap_synced_at?: string | null;
  sap_sync_status?: string | null;
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
