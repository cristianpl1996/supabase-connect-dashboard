import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['budget-rules'],
    queryFn: listBudgetRules,
    staleTime: 5 * 60_000,
  });

  const config: BudgetRulesConfig = useMemo(() => {
    const c: BudgetRulesConfig = {};
    rules.forEach((rule) => { c[rule.concept_key] = rule.is_budget_source; });
    return c;
  }, [rules]);

  const toggleMutation = useMutation({
    mutationFn: ({ conceptKey, newValue }: { conceptKey: string; newValue: boolean }) =>
      updateBudgetRule(conceptKey, newValue),
    onMutate: async ({ conceptKey, newValue }) => {
      await queryClient.cancelQueries({ queryKey: ['budget-rules'] });
      const previous = queryClient.getQueryData<BudgetRule[]>(['budget-rules']);
      queryClient.setQueryData<BudgetRule[]>(['budget-rules'], (prev) =>
        prev?.map((r) => r.concept_key === conceptKey ? { ...r, is_budget_source: newValue } : r) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['budget-rules'], context.previous);
    },
  });

  const toggleRule = async (conceptKey: string) => {
    const newValue = !config[conceptKey];
    await toggleMutation.mutateAsync({ conceptKey, newValue });
  };

  return {
    rules,
    config,
    isLoading,
    isError,
    errorMessage: isError ? (error instanceof Error ? error.message : 'Error desconocido') : '',
    toggleRule,
    refetch,
  };
}
