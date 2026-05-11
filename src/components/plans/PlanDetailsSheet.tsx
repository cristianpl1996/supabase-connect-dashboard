import { useEffect, useState } from "react";
import { getPlan } from "@/lib/api";
import { AnnualPlan, PlanFund } from "@/types/database";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Building2, CalendarDays, DollarSign, FileText, Percent, Target, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlanDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AnnualPlan | null;
  labName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  activo: { label: "Activo", variant: "default" },
  negociacion: { label: "En negociacion", variant: "secondary" },
  cerrado: { label: "Cerrado", variant: "outline" },
};

const BAR_COLORS = ["bg-primary", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];
const STRIPED_BAR_CLASS = "bg-[linear-gradient(45deg,rgba(255,255,255,.24)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.24)_50%,rgba(255,255,255,.24)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] motion-safe:animate-[progress-stripes_1s_linear_infinite]";

export function PlanDetailsSheet({ open, onOpenChange, plan, labName }: PlanDetailsSheetProps) {
  const [funds, setFunds] = useState<PlanFund[]>([]);
  const [loading, setLoading] = useState(false);
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    if (open && plan) {
      setBarsReady(false);
      const fetchPlan = async () => {
        setLoading(true);
        try {
          const details = await getPlan(plan.id);
          setFunds(details.funds || []);
        } catch (err) {
          console.error("Error loading funds:", err);
        } finally {
          setLoading(false);
        }
      };
      void fetchPlan();
    }
  }, [open, plan]);

  useEffect(() => {
    if (!open || loading) return;
    const timer = window.setTimeout(() => setBarsReady(true), 120);
    return () => window.clearTimeout(timer);
  }, [open, loading, funds.length]);

  if (!plan) return null;

  const formatCurrency = (value: number) => new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  const resolvedFunds = funds.map((fund) => {
    const resolvedAmount = fund.amount_type === "porcentaje"
      ? (plan.total_purchase_goal || 0) * (fund.amount_value || 0) / 100
      : fund.amount_value || 0;
    return { ...fund, resolvedAmount };
  });

  const totalBudget = plan.total_budget_allocated || 0;
  const purchaseGoal = plan.total_purchase_goal || 0;
  const statusConfig = STATUS_CONFIG[plan.status || "activo"] || STATUS_CONFIG.activo;
  const fundedPercent = purchaseGoal > 0 ? Math.min((totalBudget / purchaseGoal) * 100, 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">
        <div className="bg-background px-4 pb-3 pt-5 sm:px-6">
          <SheetHeader className="text-left">
            <div className="pr-8">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                  <Badge variant="outline">{plan.year}</Badge>
                </div>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-bold sm:text-2xl">
                    {plan.name || `Plan ${plan.year}`}
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium text-foreground">{labName || plan.laboratory_name || "Laboratorio"}</span>
                    <span className="hidden text-muted-foreground sm:inline">/</span>
                    <span>Plan comercial anual</span>
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-5 px-4 py-4 sm:px-6">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <PlanMetric icon={WalletCards} label="Presupuesto" value={formatCurrency(totalBudget)} note={`${funds.length} fondos`} />
            <PlanMetric icon={Target} label="Meta de compra" value={formatCurrency(purchaseGoal)} note="Objetivo negociado" />
            <PlanMetric icon={DollarSign} label="Cobertura" value={`${fundedPercent.toFixed(1)}%`} note="Presupuesto sobre meta" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlanMetric icon={Building2} label="Laboratorio" value={labName || plan.laboratory_name || "N/A"} note="Aliado comercial" />
            <PlanMetric icon={CalendarDays} label="Vigencia" value={String(plan.year)} note="Periodo del plan" />
          </div>

          <section className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Datos del acuerdo</h3>
              </div>
              {plan.contract_pdf_url && <Badge variant="outline">Contrato cargado</Badge>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PlanFact label="Responsable" value={plan.created_by_responsible} />
              <PlanFact label="Identificador" value={plan.created_by_identifier} />
              <PlanFact label="Marca origen" value={plan.created_by_brand} />
              <PlanFact label="Creado" value={plan.created_at ? new Date(plan.created_at).toLocaleDateString("es-CO") : null} />
            </div>
          </section>

          <section className="rounded-md border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Fondos del plan</h3>
              </div>
              <Badge variant="secondary">{funds.length} conceptos</Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : resolvedFunds.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Este plan no tiene fondos asignados.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex h-7 overflow-hidden rounded-md bg-muted">
                  {resolvedFunds.map((fund, index) => {
                    const percentage = totalBudget > 0 ? (fund.resolvedAmount / totalBudget) * 100 : 0;
                    return (
                      <div
                        key={fund.id}
                        className={`${BAR_COLORS[index % BAR_COLORS.length]} ${STRIPED_BAR_CLASS} transition-[width] duration-700 ease-out`}
                        style={{ width: barsReady ? `${percentage}%` : "0%" }}
                        title={`${fund.concept}: ${formatCurrency(fund.resolvedAmount)}`}
                      />
                    );
                  })}
                </div>

                <div className="grid gap-3">
                  {resolvedFunds.map((fund, index) => {
                    const percentage = totalBudget > 0 ? (fund.resolvedAmount / totalBudget) * 100 : 0;
                    return (
                      <div key={fund.id} className="rounded-md border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`} />
                              <p className="truncate font-semibold">{fund.concept}</p>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="gap-1">
                                {fund.amount_type === "porcentaje" ? <Percent className="h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
                                {fund.amount_type === "porcentaje" ? `${fund.amount_value}%` : "Fijo"}
                              </Badge>
                              <Badge variant="secondary">{fund.budget_period || "annual"}</Badge>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-mono font-bold">{formatCurrency(fund.resolvedAmount)}</p>
                            <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% del presupuesto</p>
                          </div>
                        </div>
                        <AnimatedProgress value={percentage} active={barsReady} className="mt-3" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PlanMetric({ icon: Icon, label, value, note }: { icon: React.ElementType; label: string; value: string; note: string }) {
  return (
    <div className="min-h-[7rem] rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-2 break-words text-2xl font-bold leading-tight text-foreground">{value}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function AnimatedProgress({ value, active, className = "" }: { value: number; active: boolean; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-muted ${className}`}>
      <div
        className={`h-full rounded-full bg-primary ${STRIPED_BAR_CLASS} transition-[width] duration-700 ease-out`}
        style={{ width: active ? `${Math.max(0, Math.min(value, 100))}%` : "0%" }}
      />
    </div>
  );
}

function PlanFact({ label, value }: { label: string; value: unknown }) {
  const display = value === null || value === undefined || value === "" ? "N/A" : String(value);
  return (
    <div className="rounded-md bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{display}</p>
    </div>
  );
}
