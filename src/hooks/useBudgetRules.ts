import { useState, useEffect, useCallback } from 'react';
import { listBudgetRules, updateBudgetRule } from '@/lib/api';

export interface BudgetRule {
  id: string;
  concept_key: string;
  label: string;
  is_budget_source: boolean;
  created_at: string;
}

export type BudgetRulesConfig = Record<string, boolean>;

export function mapFundToBudgetRuleKey(concept: string, amountType: string): string {
  const normalized = concept.toLowerCase().trim();

  if (normalized === 'rebate sell-in') return 'rebate_sell_in_perc';
  if (normalized === 'rebate sell-out') return 'rebate_sell_out_perc';
  if (normalized === 'pronto pago') return 'invoice_discount_perc';
  if (normalized === 'marketing' && amountType === 'porcentaje') return 'marketing_perc';
  if (normalized === 'marketing' && amountType === 'fijo') return 'marketing_fixed_value';
  if (normalized === 'coop') return 'marketing_fixed_value';
  if (normalized === 'otro') return 'invoice_discount_perc';

  return 'invoice_discount_perc';
}

export function isFundSpendable(
  config: BudgetRulesConfig,
  concept: string,
  amountType: string
): boolean {
  const key = mapFundToBudgetRuleKey(concept, amountType);
  return config[key] ?? false;
}

export async function fetchBudgetRulesConfig(): Promise<BudgetRulesConfig> {
  const data = await listBudgetRules();
  const config: BudgetRulesConfig = {};
  (data || []).forEach((rule) => {
    config[rule.concept_key] = rule.is_budget_source;
  });
  return config;
}

export function useBudgetRules() {
  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [config, setConfig] = useState<BudgetRulesConfig>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listBudgetRules();
      setRules(data || []);
      const nextConfig: BudgetRulesConfig = {};
      (data || []).forEach((rule) => {
        nextConfig[rule.concept_key] = rule.is_budget_source;
      });
      setConfig(nextConfig);
    } catch (error) {
      console.error('Error fetching budget_rules:', error);
      setRules([]);
      setConfig({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const toggleRule = useCallback(async (conceptKey: string) => {
    const newValue = !config[conceptKey];
    setConfig((prev) => ({ ...prev, [conceptKey]: newValue }));
    setRules((prev) =>
      prev.map((r) =>
        r.concept_key === conceptKey
          ? { ...r, is_budget_source: newValue }
          : r
      )
    );

    try {
      await updateBudgetRule(conceptKey, newValue);
    } catch (error) {
      console.error('Error updating budget_rule:', error);
      setConfig((prev) => ({ ...prev, [conceptKey]: !newValue }));
      setRules((prev) =>
        prev.map((r) =>
          r.concept_key === conceptKey
            ? { ...r, is_budget_source: !newValue }
            : r
        )
      );
      throw error;
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
