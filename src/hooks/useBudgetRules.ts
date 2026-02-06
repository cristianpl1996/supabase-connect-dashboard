import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface BudgetRule {
  id: string;
  concept_key: string;
  label: string;
  is_budget_source: boolean;
  created_at: string;
}

export type BudgetRulesConfig = Record<string, boolean>;

/**
 * Maps a plan_fund record (concept + amount_type) to a budget_rules concept_key.
 */
export function mapFundToBudgetRuleKey(concept: string, amountType: string): string {
  const normalized = concept.toLowerCase().trim();

  if (normalized === 'rebate sell-in') return 'rebate_sell_in_perc';
  if (normalized === 'rebate sell-out') return 'rebate_sell_out_perc';
  if (normalized === 'pronto pago') return 'invoice_discount_perc'; // financial discount
  if (normalized === 'marketing' && amountType === 'porcentaje') return 'marketing_perc';
  if (normalized === 'marketing' && amountType === 'fijo') return 'marketing_fixed_value';
  if (normalized === 'coop') return 'marketing_fixed_value';
  if (normalized === 'otro') return 'invoice_discount_perc';

  return 'invoice_discount_perc';
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
 * Fetch budget rules from Supabase (for use in async/non-hook contexts).
 */
export async function fetchBudgetRulesConfig(): Promise<BudgetRulesConfig> {
  const { data, error } = await supabase
    .from('budget_rules')
    .select('concept_key, is_budget_source');

  if (error) {
    console.error('Error fetching budget_rules:', error);
    return {};
  }

  const config: BudgetRulesConfig = {};
  (data || []).forEach((rule) => {
    config[rule.concept_key] = rule.is_budget_source;
  });
  return config;
}

/**
 * Hook to manage budget rules configuration with Supabase persistence.
 */
export function useBudgetRules() {
  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [config, setConfig] = useState<BudgetRulesConfig>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('budget_rules')
      .select('*')
      .order('created_at');

    if (error) {
      console.error('Error fetching budget_rules:', error);
    } else {
      setRules(data || []);
      const newConfig: BudgetRulesConfig = {};
      (data || []).forEach((rule) => {
        newConfig[rule.concept_key] = rule.is_budget_source;
      });
      setConfig(newConfig);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggleRule = useCallback(async (conceptKey: string) => {
    // Optimistic update
    setConfig((prev) => ({ ...prev, [conceptKey]: !prev[conceptKey] }));
    setRules((prev) =>
      prev.map((r) =>
        r.concept_key === conceptKey
          ? { ...r, is_budget_source: !r.is_budget_source }
          : r
      )
    );

    const newValue = !config[conceptKey];

    const { error } = await supabase
      .from('budget_rules')
      .update({ is_budget_source: newValue })
      .eq('concept_key', conceptKey);

    if (error) {
      console.error('Error updating budget_rule:', error);
      // Rollback on error
      setConfig((prev) => ({ ...prev, [conceptKey]: !newValue }));
      setRules((prev) =>
        prev.map((r) =>
          r.concept_key === conceptKey
            ? { ...r, is_budget_source: !newValue }
            : r
        )
      );
    }
  }, [config]);

  return {
    rules,
    config,
    isLoading,
    toggleRule,
    refetch: fetchRules,
  };
}
