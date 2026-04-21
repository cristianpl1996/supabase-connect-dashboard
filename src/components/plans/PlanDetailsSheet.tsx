import { useEffect, useState } from 'react';
import { getPlan } from '@/lib/api';
import { AnnualPlan, PlanFund } from '@/types/database';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Loader2, TrendingUp, Percent, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlanDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AnnualPlan | null;
  labName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  activo: { label: 'Activo', variant: 'default' },
  negociacion: { label: 'En Negociacion', variant: 'secondary' },
  cerrado: { label: 'Cerrado', variant: 'outline' },
};

export function PlanDetailsSheet({ open, onOpenChange, plan, labName }: PlanDetailsSheetProps) {
  const [funds, setFunds] = useState<PlanFund[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && plan) {
      const fetchPlan = async () => {
        setLoading(true);
        try {
          const details = await getPlan(plan.id);
          setFunds(details.funds || []);
        } catch (err) {
          console.error('Error loading funds:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchPlan();
    }
  }, [open, plan]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const resolvedFunds = funds.map((fund) => {
    const resolvedAmount = fund.amount_type === 'porcentaje'
      ? (plan?.total_purchase_goal || 0) * (fund.amount_value || 0) / 100
      : fund.amount_value || 0;
    return { ...fund, resolvedAmount };
  });

  const totalBudget = plan?.total_budget_allocated || 0;
  const statusConfig = STATUS_CONFIG[plan?.status || 'activo'] || STATUS_CONFIG.activo;

  if (!plan) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl">{labName || plan.laboratory_name || 'Laboratorio'}</SheetTitle>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
          <SheetDescription>
            Plan Ano {plan.year}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" />
                Meta de Compra
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(plan.total_purchase_goal || 0)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" />
                Presupuesto Total
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(totalBudget)}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Desglose de Fondos ({funds.length})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : funds.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Este plan no tiene fondos asignados
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {resolvedFunds.map((fund) => {
                  const percentage = totalBudget > 0
                    ? (fund.resolvedAmount / totalBudget) * 100
                    : 0;

                  return (
                    <div key={fund.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">
                            {fund.concept}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {fund.amount_type === 'porcentaje' ? (
                              <><Percent className="h-3 w-3 mr-1" />{fund.amount_value}%</>
                            ) : (
                              <><DollarSign className="h-3 w-3 mr-1" />Fijo</>
                            )}
                          </Badge>
                        </div>
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatCurrency(fund.resolvedAmount)}
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {percentage.toFixed(1)}% del presupuesto total
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {funds.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Distribucion Visual
                </h3>
                <div className="flex h-6 rounded-lg overflow-hidden">
                  {resolvedFunds.map((fund, index) => {
                    const percentage = totalBudget > 0
                      ? (fund.resolvedAmount / totalBudget) * 100
                      : 0;

                    const colors = [
                      'bg-primary',
                      'bg-blue-500',
                      'bg-green-500',
                      'bg-amber-500',
                      'bg-purple-500',
                      'bg-pink-500',
                    ];

                    return (
                      <div
                        key={fund.id}
                        className={`${colors[index % colors.length]} transition-all`}
                        style={{ width: `${percentage}%` }}
                        title={`${fund.concept}: ${formatCurrency(fund.resolvedAmount)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {resolvedFunds.map((fund, index) => {
                    const colors = [
                      'bg-primary',
                      'bg-blue-500',
                      'bg-green-500',
                      'bg-amber-500',
                      'bg-purple-500',
                      'bg-pink-500',
                    ];

                    return (
                      <div key={fund.id} className="flex items-center gap-1.5 text-xs">
                        <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`} />
                        <span className="text-muted-foreground">{fund.concept}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
