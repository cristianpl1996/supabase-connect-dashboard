import type {
  Plan,
  PlanExtractionApprovePayload,
  PlanFundModifier,
  PlanFundScale,
  FundPaymentMethod,
  SettlementFrequency,
} from '@/lib/api';

// Espejo del FUND_TYPE_TO_CONCEPT del backend (app/schemas/plan_extraction.py)
const FUND_TYPE_TO_CONCEPT: Record<string, string> = {
  rebate_sell_in: 'Rebate Sell-In',
  rebate_sell_out: 'Rebate Sell-Out',
  invoice_discount: 'Desc. Pie Factura',
  early_payment: 'Pronto Pago',
  marketing: 'Marketing',
  other: 'Otro',
};

export interface ReviewPeriod {
  label: string;
  start_date: string;
  end_date: string;
  goal_value: number | null;
  goal_unit: 'money' | 'units';
  distribution_pct: number | null;
}

export interface ReviewFund {
  concept: string;
  amount_type: 'fijo' | 'porcentaje';
  amount_value: number | null;
  settlement_frequency: SettlementFrequency;
  payment_method: FundPaymentMethod;
  product_exclusions: string | null;
  compliance_threshold_pct: number;
  allows_carryover: boolean;
  description?: string | null;
  scales: PlanFundScale[];
  periods: ReviewPeriod[];
  modifiers: PlanFundModifier[];
}

export interface ReviewCondition {
  condition_type: 'current_account' | 'compliance_threshold' | 'interim_progress' | 'information_delivery' | 'other';
  fund_index: number | null;
  params_text: string;
  original_text: string | null;
  is_blocking: boolean;
}

export interface ReviewState {
  name: string;
  year: number;
  validity_start_date: string;
  validity_end_date: string;
  total_purchase_goal: number | null;
  notes: string;
  supplier_name: string | null;
  doc_type: string;
  uncertain_fields: string[];
  funds: ReviewFund[];
  periods: ReviewPeriod[];
  conditions: ReviewCondition[];
}

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw => (value && typeof value === 'object' ? (value as Raw) : {});
const asArray = (value: unknown): Raw[] => (Array.isArray(value) ? value.map(asRecord) : []);
const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const asString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

function mapPeriod(raw: Raw): ReviewPeriod {
  return {
    label: asString(raw.label) ?? '',
    start_date: asString(raw.start) ?? asString(raw.start_date) ?? '',
    end_date: asString(raw.end) ?? asString(raw.end_date) ?? '',
    goal_value: asNumber(raw.goal_value),
    goal_unit: raw.goal_unit === 'units' ? 'units' : 'money',
    distribution_pct: asNumber(raw.distribution_pct),
  };
}

function mapFund(raw: Raw): ReviewFund {
  const fundType = asString(raw.type) ?? 'other';
  const scope = asRecord(raw.scope);
  const exclusions = Array.isArray(scope.exclusions) ? (scope.exclusions as string[]).join('; ') : null;
  const scales = asArray(raw.scales).map((scale) => ({
    level: asNumber(scale.level) ?? 1,
    goal_value: asNumber(scale.goal_value) ?? 0,
    goal_unit: scale.goal_unit === 'units' ? ('units' as const) : ('money' as const),
    benefit_pct: asNumber(scale.benefit_pct) ?? 0,
  }));
  const fixedValue = asNumber(raw.fixed_value);
  const basePct = asNumber(raw.base_pct) ?? scales[0]?.benefit_pct ?? null;
  const concept =
    fundType === 'other'
      ? asString(raw.description) ?? 'Otro'
      : FUND_TYPE_TO_CONCEPT[fundType] ?? 'Otro';
  return {
    concept,
    amount_type: fixedValue !== null && basePct === null ? 'fijo' : 'porcentaje',
    amount_value: fixedValue !== null && basePct === null ? fixedValue : basePct,
    settlement_frequency: (asString(raw.settlement_frequency) as SettlementFrequency) ?? 'annual',
    payment_method: (asString(raw.payment_method) as FundPaymentMethod) ?? 'credit_note',
    product_exclusions: exclusions,
    compliance_threshold_pct: asNumber(raw.compliance_threshold_pct) ?? 100,
    allows_carryover: raw.allows_carryover !== false,
    description: asString(raw.description),
    scales,
    periods: asArray(raw.periods).map(mapPeriod),
    modifiers: asArray(raw.modifiers).map((modifier) => ({
      modifier_type: modifier.type === 'cap' || modifier.modifier_type === 'cap' ? ('cap' as const) : ('penalty' as const),
      condition_text: asString(modifier.condition_text),
      effect_pct: asNumber(modifier.effect_pct),
      cap_pct_over_goal: asNumber(modifier.cap_pct_over_goal),
    })),
  };
}

/** Construye el estado de revisión desde review_draft_data (si existe) o ai_extracted_data. */
export function buildReviewState(plan: Plan): ReviewState {
  const draft = plan.review_draft_data as ReviewState | null | undefined;
  if (draft && Array.isArray(draft.funds)) {
    return draft;
  }
  const raw = asRecord(plan.ai_extracted_data);
  const validity = asRecord(raw.validity);
  const supplier = asRecord(raw.supplier);
  const year = asNumber(validity.year) ?? plan.year;
  return {
    name: plan.name,
    year,
    validity_start_date: asString(validity.start) ?? plan.validity_start_date,
    validity_end_date: asString(validity.end) ?? plan.validity_end_date,
    total_purchase_goal: asNumber(raw.total_purchase_goal) ?? plan.total_purchase_goal,
    notes: asString(raw.dependency_notes) ?? plan.notes ?? '',
    supplier_name: asString(supplier.name),
    doc_type: asString(raw.doc_type) ?? 'annual_plan',
    uncertain_fields: Array.isArray(raw.uncertain_fields) ? (raw.uncertain_fields as string[]) : [],
    funds: asArray(raw.funds).map(mapFund),
    periods: [],
    conditions: asArray(raw.conditions).map((condition) => ({
      condition_type:
        (asString(condition.type) as ReviewCondition['condition_type']) ?? 'other',
      fund_index: asNumber(condition.applies_to_fund_index),
      params_text: condition.params ? JSON.stringify(condition.params) : '',
      original_text: asString(condition.original_text),
      is_blocking: condition.is_blocking !== false,
    })),
  };
}

export function toApprovePayload(state: ReviewState): PlanExtractionApprovePayload {
  return {
    name: state.name || null,
    year: state.year,
    validity_start_date: state.validity_start_date,
    validity_end_date: state.validity_end_date,
    total_purchase_goal: state.total_purchase_goal ?? 0,
    notes: state.notes || null,
    funds: state.funds.map((fund) => ({
      concept: fund.concept,
      amount_type: fund.amount_type,
      amount_value: fund.amount_value,
      settlement_frequency: fund.settlement_frequency,
      payment_method: fund.payment_method,
      product_exclusions: fund.product_exclusions,
      compliance_threshold_pct: fund.compliance_threshold_pct,
      allows_carryover: fund.allows_carryover,
      scales: fund.scales,
      periods: fund.periods.map((period) => ({
        label: period.label,
        start_date: period.start_date,
        end_date: period.end_date,
        goal_value: period.goal_value,
        goal_unit: period.goal_unit,
        distribution_pct: period.distribution_pct,
      })),
      modifiers: fund.modifiers,
    })),
    periods: state.periods.map((period) => ({
      label: period.label,
      start_date: period.start_date,
      end_date: period.end_date,
      goal_value: period.goal_value,
      goal_unit: period.goal_unit,
      distribution_pct: period.distribution_pct,
    })),
    conditions: state.conditions.map((condition) => {
      let params: Record<string, unknown> | null = null;
      if (condition.params_text.trim()) {
        try {
          params = JSON.parse(condition.params_text) as Record<string, unknown>;
        } catch {
          params = { raw: condition.params_text };
        }
      }
      return {
        condition_type: condition.condition_type,
        fund_index: condition.fund_index,
        params,
        original_text: condition.original_text,
        is_blocking: condition.is_blocking,
      };
    }),
  };
}

/** Validaciones cliente (espejo de las del servidor en approve_extraction). */
export function validateReviewState(state: ReviewState): string[] {
  const errors: string[] = [];
  if (!state.validity_start_date || !state.validity_end_date) {
    errors.push('La vigencia (inicio y fin) es obligatoria.');
  } else if (state.validity_start_date > state.validity_end_date) {
    errors.push('El inicio de vigencia debe ser anterior o igual al fin.');
  }
  if (!state.total_purchase_goal || state.total_purchase_goal <= 0) {
    errors.push('La meta total de compras debe ser mayor que 0.');
  }
  const checkPeriods = (periods: ReviewPeriod[], scope: string) => {
    for (const period of periods) {
      if (!period.label || !period.start_date || !period.end_date) {
        errors.push(`Período incompleto en ${scope} (etiqueta y fechas son obligatorias).`);
        continue;
      }
      if (period.start_date > period.end_date) {
        errors.push(`Período '${period.label}' (${scope}): inicio posterior al fin.`);
      }
      if (period.start_date < state.validity_start_date || period.end_date > state.validity_end_date) {
        errors.push(`Período '${period.label}' (${scope}) está fuera de la vigencia del plan.`);
      }
    }
    const distributions = periods
      .map((period) => period.distribution_pct)
      .filter((value): value is number => value !== null);
    if (distributions.length > 0) {
      const total = distributions.reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 100) > 1) {
        errors.push(`La suma de distribution_pct en ${scope} debe ser ≈ 100% (actual: ${total.toFixed(1)}%).`);
      }
    }
  };
  checkPeriods(state.periods, 'el plan');
  state.funds.forEach((fund, index) => {
    if (!fund.concept.trim()) {
      errors.push(`El fondo ${index + 1} no tiene concepto.`);
    }
    checkPeriods(fund.periods, `fondo '${fund.concept || index + 1}'`);
    const scales = [...fund.scales].sort((a, b) => a.level - b.level);
    for (let i = 1; i < scales.length; i += 1) {
      if (scales[i].goal_value <= scales[i - 1].goal_value) {
        errors.push(`Fondo '${fund.concept}': las metas de las escalas deben ser crecientes por nivel.`);
        break;
      }
    }
    const levels = scales.map((scale) => scale.level);
    if (new Set(levels).size !== levels.length) {
      errors.push(`Fondo '${fund.concept}': hay niveles de escala duplicados.`);
    }
  });
  return errors;
}

/** Clase ámbar para campos null o mencionados en uncertain_fields. */
export function uncertainClass(
  uncertainFields: string[],
  value: unknown,
  ...tokens: string[]
): string {
  const empty = value === null || value === undefined || value === '';
  const flagged = tokens.some((token) =>
    uncertainFields.some((field) => field.toLowerCase().includes(token.toLowerCase())),
  );
  return empty || flagged ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : '';
}
