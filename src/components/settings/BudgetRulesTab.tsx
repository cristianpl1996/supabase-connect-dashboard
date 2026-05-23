import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Info } from 'lucide-react';
import { useEffect } from 'react';
import { useBudgetRules } from '@/hooks/useBudgetRules';
import { ModuleErrorCard } from '@/components/common/ModuleErrorCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BudgetRulesTabProps {
  onError?: (hasError: boolean) => void;
}

export function BudgetRulesTab({ onError }: BudgetRulesTabProps) {
  const { rules, config, isLoading, isError, errorMessage, refetch, toggleRule } = useBudgetRules();

  useEffect(() => { onError?.(isError); }, [isError, onError]);

  const handleToggleRule = async (conceptKey: string) => {
    await toggleRule(conceptKey);
    toast.success('Regla actualizada');
  };

  const spendableCount = Object.values(config).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <Info className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              ¿Qué es "Presupuesto Gastable"?
            </p>
            <p className="text-sm text-muted-foreground">
              Define qué conceptos del acuerdo con el laboratorio pueden usarse para financiar promociones.
              Los conceptos marcados como <strong>NO gastables</strong> (ej: Rebates, Descuentos Financieros)
              se registran como dato informativo pero <strong>no suman al saldo disponible</strong> para crear promociones.
              Esto protege el margen del distribuidor.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rules Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className={cn("flex items-center gap-2", isError && "text-muted-foreground")}>
                <ShieldCheck className={cn("size-5", isError ? "text-primary/40" : "text-primary")} />
                Conceptos del Plan Anual
              </CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? (
                  <span className="inline-block h-4 w-48 animate-pulse rounded bg-muted" />
                ) : isError ? (
                  'No se pudieron cargar las reglas'
                ) : (
                  `${spendableCount} de ${rules.length} conceptos marcados como gastables`
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError && (
            <ModuleErrorCard
              message={errorMessage}
              onRetry={refetch}
              loading={isLoading}
            />
          )}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShieldCheck className="size-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No se pudieron cargar las reglas de presupuesto</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rules.map((rule) => {
                const isActive = config[rule.concept_key] ?? false;
                return (
                  <div
                    key={rule.id}
                    className="flex items-start justify-between gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex-1 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label
                          htmlFor={rule.concept_key}
                          className="text-base font-medium cursor-pointer"
                        >
                          {rule.label}
                        </Label>
                        <Badge
                          variant={isActive ? 'default' : 'outline'}
                          className={
                            isActive
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'text-muted-foreground'
                          }
                        >
                          {isActive ? 'Gastable' : 'Informativo'}
                        </Badge>
                      </div>
                    </div>
                    <Switch
                      id={rule.concept_key}
                      checked={isActive}
                      onCheckedChange={() => handleToggleRule(rule.concept_key)}
                      disabled={isLoading}
                      aria-label={`¿${rule.label} es presupuesto gastable?`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impact Summary */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/35 dark:bg-amber-500/10">
        <CardContent className="flex items-start gap-3 pt-6">
          <ShieldCheck className="size-5 text-amber-600 shrink-0 mt-0.5 dark:text-amber-300" />
          <div className="space-y-1">
            <p className="font-medium text-foreground dark:text-amber-50">Impacto en la Billetera</p>
            <p className="text-sm text-muted-foreground dark:text-amber-100/75">
              Solo los conceptos marcados como <strong>"Gastable"</strong> se sumarán
              al saldo disponible en la Billetera. Si un concepto está apagado, su valor
              aparecerá en el sistema como referencia pero <strong>no se podrá usar para
              financiar promociones</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
