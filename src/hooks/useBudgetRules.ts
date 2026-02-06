import { useState, useEffect, useCallback } from 'react';

export interface BudgetRuleConcept {
  key: string;
  label: string;
  description: string;
  defaultSpendable: boolean;
}

/**
 * Fixed list of fund concepts extracted from annual plans.
 * Each maps to how plan_funds records are categorized.
 */
export const BUDGET_RULE_CONCEPTS: BudgetRuleConcept[] = [
  {
    key: 'descuento_pie_factura',
    label: 'Descuento Pie de Factura',
    description: 'Descuento aplicado directamente en la factura de compra',
    defaultSpendable: false,
  },
  {
    key: 'rebate_sell_in',
    label: 'Rebate Sell-In',
    description: 'Rebate por cumplimiento de meta de compra',
    defaultSpendable: false,
  },
  {
    key: 'rebate_sell_out',
    label: 'Rebate Sell-Out',
    description: 'Rebate por cumplimiento de meta de venta al cliente final',
    defaultSpendable: false,
  },
  {
    key: 'marketing_pct',
    label: 'Marketing (%)',
    description: 'Porcentaje destinado a actividades de marketing',
    defaultSpendable: true,
  },
  {
    key: 'marketing_fijo',
    label: 'Marketing (Valor Fijo)',
    description: 'Monto fijo destinado a actividades de marketing',
    defaultSpendable: true,
  },
  {
    key: 'descuento_financiero',
    label: 'Descuento Financiero / Pronto Pago',
    description: 'Incentivo por pago anticipado o pronto pago',
    defaultSpendable: false,
  },
];

const STORAGE_KEY = 'ivanagro_budget_rules';

export type BudgetRulesConfig = Record<string, boolean>;

function getDefaultConfig(): BudgetRulesConfig {
  const config: BudgetRulesConfig = {};
  BUDGET_RULE_CONCEPTS.forEach((c) => {
    config[c.key] = c.defaultSpendable;
  });
  return config;
}

function loadConfig(): BudgetRulesConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as BudgetRulesConfig;
      // Merge with defaults to handle new concepts added later
      const defaults = getDefaultConfig();
      return { ...defaults, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return getDefaultConfig();
}

/**
 * Maps a plan_fund record (concept + amount_type) to a budget rule key.
 */
export function mapFundToBudgetRuleKey(concept: string, amountType: string): string {
  const normalized = concept.toLowerCase().trim();

  if (normalized === 'rebate sell-in') return 'rebate_sell_in';
  if (normalized === 'rebate sell-out') return 'rebate_sell_out';
  if (normalized === 'pronto pago') return 'descuento_financiero';
  if (normalized === 'marketing' && amountType === 'porcentaje') return 'marketing_pct';
  if (normalized === 'marketing' && amountType === 'fijo') return 'marketing_fijo';
  if (normalized === 'coop') return 'marketing_fijo'; // Coop treated as marketing fixed
  if (normalized === 'otro') return 'descuento_pie_factura';

  // Fallback: not spendable by default
  return 'descuento_pie_factura';
}

/**
 * Check if a specific plan_fund is spendable according to the config.
 */
export function isFundSpendable(
  config: BudgetRulesConfig,
  concept: string,
  amountType: string
): boolean {
  const key = mapFundToBudgetRuleKey(concept, amountType);
  return config[key] ?? false;
}

/**
 * Hook to manage budget rules configuration with localStorage persistence.
 */
export function useBudgetRules() {
  const [config, setConfig] = useState<BudgetRulesConfig>(loadConfig);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const toggleRule = useCallback((key: string) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setRule = useCallback((key: string, value: boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfig(getDefaultConfig());
  }, []);

  return {
    config,
    concepts: BUDGET_RULE_CONCEPTS,
    toggleRule,
    setRule,
    resetToDefaults,
  };
}

/**
 * Static function to get budget rules without hook (for use in async functions).
 */
export function getBudgetRulesConfig(): BudgetRulesConfig {
  return loadConfig();
}
