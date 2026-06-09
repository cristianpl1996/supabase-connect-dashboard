import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
import {
  getPlan,
  getPlanCompliance,
  BASE_URL,
  type Plan,
  type PlanCondition,
  type PlanFund,
  type PlanPeriod,
} from "@/lib/api";
import { AnnualPlan } from "@/types/database";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  DollarSign,
  FileText,
  GitBranch,
  Percent,
  Target,
  WalletCards,
  ExternalLink,
  XCircle,
} from "lucide-react";
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

const CONCEPT_LABELS: Record<string, string> = {
  Desc_Pie_Factura: "Descuento Pie de Factura",
  Rebate_SellIn: "Rebate Sell In",
  Rebate_SellOut: "Rebate Sell Out",
  Marketing: "Marketing",
  Pronto_Pago: "Pronto Pago",
};

const SETTLEMENT_LABELS: Record<string, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  biannual: "Semestral",
  annual: "Anual",
};

const CONDITION_LABELS: Record<string, string> = {
  current_account: "Cartera al día",
  compliance_threshold: "Umbral de cumplimiento",
  interim_progress: "Avance intermedio",
  information_delivery: "Entrega de información",
  other: "Otra",
};

const FUND_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  earned: { label: "Ganado", className: "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30" },
  pending: { label: "Pendiente", className: "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30" },
  not_reached: { label: "Escala no alcanzada", className: "border-muted-foreground/30 text-muted-foreground" },
  blocked: { label: "Bloqueado", className: "border-destructive/50 text-destructive" },
};

function getConceptLabel(concept: string): string {
  return CONCEPT_LABELS[concept] ?? concept;
}

function conditionState(condition: PlanCondition & { state?: string }): "met" | "pending" | "unmet" {
  if (condition.state === "met" || condition.state === "unmet") return condition.state;
  const status = String((condition.params as Record<string, unknown> | null)?.status ?? "pending").toLowerCase();
  if (["met", "satisfied", "cumplida"].includes(status)) return "met";
  if (["unmet", "failed", "incumplida"].includes(status)) return "unmet";
  return "pending";
}

const BAR_COLORS = ["bg-primary", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500", "bg-pink-500"];
const STRIPED_BAR_CLASS = "bg-[linear-gradient(45deg,rgba(255,255,255,.24)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.24)_50%,rgba(255,255,255,.24)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] motion-safe:animate-[progress-stripes_1s_linear_infinite]";

const formatCurrency = (value: number) => COP_FORMATTER.format(value);
const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("es-CO");

export function PlanDetailsSheet({ open, onOpenChange, plan, labName }: PlanDetailsSheetProps) {
  const [details, setDetails] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    if (open && plan) {
      setBarsReady(false);
      setDetails(null);
      const fetchPlan = async () => {
        setLoading(true);
        try {
          const data = await getPlan(plan.id);
          setDetails(data);
        } catch (err) {
          console.error("Error loading plan details:", err);
        } finally {
          setLoading(false);
        }
      };
      void fetchPlan();
    }
  }, [open, plan]);

  const funds = details?.funds ?? [];

  useEffect(() => {
    if (!open || loading) return;
    const timer = window.setTimeout(() => setBarsReady(true), 120);
    return () => window.clearTimeout(timer);
  }, [open, loading, funds.length]);

  if (!plan) return null;

  const resolvedFunds = funds.map((fund) => ({
    ...fund,
    resolvedAmount: fund.current_balance || 0,
  }));

  const totalBudget = plan.total_budget_allocated || 0;
  const purchaseGoal = plan.total_purchase_goal || 0;
  const statusConfig = STATUS_CONFIG[plan.status || "activo"] || STATUS_CONFIG.activo;
  const fundedPercent = purchaseGoal > 0 ? Math.min((totalBudget / purchaseGoal) * 100, 100) : 0;
  const validityLabel = plan.validity_start_date && plan.validity_end_date
    ? `${formatDate(plan.validity_start_date)} – ${formatDate(plan.validity_end_date)}`
    : String(plan.year);

  const planPeriods = (details?.periods ?? []).filter((period) => !period.plan_fund_id);
  const fundPeriods = (details?.periods ?? []).filter((period) => period.plan_fund_id);
  const conditions = details?.conditions ?? [];
  const amendments = details?.amendments ?? [];

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
                  {plan.parent_plan_id && <Badge variant="secondary">Otrosí</Badge>}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-bold sm:text-2xl">
                    {plan.name || `Plan ${plan.year}`}
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium text-foreground">{labName || plan.laboratory_name || "Laboratorio"}</span>
                    <span className="hidden text-muted-foreground sm:inline">/</span>
                    <span>Vigencia: {validityLabel}</span>
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="px-4 py-4 sm:px-6">
          <Tabs defaultValue="resumen">
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="escalas">Escalas y períodos</TabsTrigger>
              <TabsTrigger value="condiciones">Condiciones</TabsTrigger>
              <TabsTrigger value="cumplimiento">Cumplimiento</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
            </TabsList>

            {/* ── Resumen ──────────────────────────────────────────────── */}
            <TabsContent value="resumen" className="space-y-5">
              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <PlanMetric icon={WalletCards} label="Presupuesto" value={formatCurrency(totalBudget)} note={`${funds.length} fondos`} />
                <PlanMetric icon={Target} label="Meta de compra" value={formatCurrency(purchaseGoal)} note="Objetivo negociado" />
                <PlanMetric icon={DollarSign} label="Cobertura" value={`${fundedPercent.toFixed(1)}%`} note="Presupuesto sobre meta" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PlanMetric icon={Building2} label="Laboratorio" value={labName || plan.laboratory_name || "N/A"} note="Aliado comercial" />
                <PlanMetric icon={CalendarDays} label="Vigencia" value={validityLabel} note="Periodo del plan" />
              </div>

              {plan.notes && (
                <section className="rounded-md border bg-card p-4">
                  <h3 className="mb-2 font-semibold">Notas y dependencias</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{plan.notes}</p>
                </section>
              )}

              <section className="rounded-md border bg-card p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <h3 className="font-semibold">Acuerdo comercial</h3>
                  </div>
                  {plan.created_at && (
                    <span className="text-xs text-muted-foreground">
                      Creado: {new Date(plan.created_at).toLocaleDateString("es-CO")}
                    </span>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <PlanFact label="Responsable" value={plan.created_by_responsible} />
                  <PlanFact label="Identificador" value={plan.created_by_identifier} />
                  <PlanFact label="Marca origen" value={plan.created_by_brand} />
                </div>
              </section>

              <section className="rounded-md border bg-card p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="size-4 text-primary" />
                    <h3 className="font-semibold">Fondos del plan</h3>
                  </div>
                  <Badge variant="secondary">{funds.length} conceptos</Badge>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-primary" />
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
                            title={`${getConceptLabel(fund.concept)}: ${formatCurrency(fund.resolvedAmount)}`}
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
                                  <p className="truncate font-semibold">{getConceptLabel(fund.concept)}</p>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Badge variant="outline" className="gap-1">
                                    {fund.amount_type === "porcentaje" ? <Percent className="size-3" /> : <DollarSign className="size-3" />}
                                    {fund.amount_type === "porcentaje" ? `${fund.amount_value}%` : "Fijo"}
                                  </Badge>
                                  <Badge variant="secondary">{SETTLEMENT_LABELS[fund.settlement_frequency] || fund.settlement_frequency}</Badge>
                                  {(fund.scales?.length ?? 0) > 0 && (
                                    <Badge variant="outline">{fund.scales?.length} escalas</Badge>
                                  )}
                                  {fund.product_exclusions && (
                                    <Badge variant="outline" className="border-amber-400 text-amber-700">Exclusiones</Badge>
                                  )}
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
            </TabsContent>

            {/* ── Escalas y períodos (solo lectura) ────────────────────── */}
            <TabsContent value="escalas" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {funds.map((fund) => (
                    <FundScalesCard key={fund.id} fund={fund} fundPeriods={fundPeriods.filter((p) => p.plan_fund_id === fund.id)} />
                  ))}
                  <section className="rounded-md border bg-card p-4">
                    <h3 className="mb-3 font-semibold">Períodos del plan</h3>
                    {planPeriods.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Sin períodos definidos: el cumplimiento prorratea la meta por fracción de vigencia transcurrida.
                      </p>
                    ) : (
                      <PeriodsTable periods={planPeriods} />
                    )}
                  </section>
                </>
              )}
            </TabsContent>

            {/* ── Condiciones ──────────────────────────────────────────── */}
            <TabsContent value="condiciones" className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : conditions.length === 0 ? (
                <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Este plan no tiene condiciones habilitantes registradas.
                </div>
              ) : (
                conditions.map((condition) => {
                  const state = conditionState(condition);
                  return (
                    <div key={condition.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
                      {state === "met" && <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />}
                      {state === "pending" && <Circle className="mt-0.5 size-5 shrink-0 text-amber-500" />}
                      {state === "unmet" && <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{CONDITION_LABELS[condition.condition_type] || condition.condition_type}</p>
                          {condition.is_blocking && <Badge variant="outline" className="border-destructive/40 text-destructive">Bloqueante</Badge>}
                          <Badge variant="outline">
                            {state === "met" ? "Cumplida" : state === "unmet" ? "Incumplida" : "Pendiente"}
                          </Badge>
                        </div>
                        {condition.original_text && (
                          <p className="mt-1 text-sm text-muted-foreground">"{condition.original_text}"</p>
                        )}
                        {condition.params && Object.keys(condition.params).length > 0 && (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{JSON.stringify(condition.params)}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ── Cumplimiento ─────────────────────────────────────────── */}
            <TabsContent value="cumplimiento">
              <ComplianceTab planId={plan.id} enabled={open} />
            </TabsContent>

            {/* ── Documentos ───────────────────────────────────────────── */}
            <TabsContent value="documentos" className="space-y-4">
              <section className="rounded-md border bg-card p-4">
                <h3 className="mb-3 font-semibold">Contrato</h3>
                {plan.contract_pdf_url ? (
                  <a
                    href={`${BASE_URL}${plan.contract_pdf_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-lg border bg-muted/30 p-3.5 transition-all hover:border-primary/30 hover:bg-muted/50"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">Contrato firmado</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Documento PDF adjunto — fuente de verdad del acuerdo</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors group-hover:bg-primary/20">
                      Abrir
                      <ExternalLink className="size-3" />
                    </span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/20 p-3.5">
                    <FileText className="size-5 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Sin contrato adjunto</p>
                  </div>
                )}
              </section>

              <section className="rounded-md border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <GitBranch className="size-4 text-primary" />
                  <h3 className="font-semibold">Cadena de otrosíes</h3>
                </div>
                {plan.parent_plan_id && (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Este plan es un otrosí: reemplaza al plan {plan.parent_plan_id.slice(0, 8)}… desde su inicio de vigencia.
                  </p>
                )}
                {amendments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este plan no tiene otrosíes registrados.</p>
                ) : (
                  <div className="space-y-2">
                    {amendments.map((amendment) => (
                      <div key={amendment.id} className="flex items-center justify-between rounded-md border p-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{amendment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Vigencia: {formatDate(amendment.validity_start_date)} – {formatDate(amendment.validity_end_date)}
                          </p>
                        </div>
                        <Badge variant="secondary">{STATUS_CONFIG[amendment.status]?.label || amendment.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FundScalesCard({ fund, fundPeriods }: { fund: PlanFund; fundPeriods: PlanPeriod[] }) {
  const scales = fund.scales ?? [];
  const modifiers = fund.modifiers ?? [];
  return (
    <section className="rounded-md border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{getConceptLabel(fund.concept)}</h3>
        <Badge variant="secondary">{SETTLEMENT_LABELS[fund.settlement_frequency] || fund.settlement_frequency}</Badge>
        {fund.compliance_threshold_pct < 100 && (
          <Badge variant="outline">Umbral ≥{fund.compliance_threshold_pct}%</Badge>
        )}
      </div>

      {scales.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin escalas: aplica el {fund.amount_type === "porcentaje" ? `${fund.amount_value}% plano` : "valor fijo"} del fondo.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-1.5">Nivel</th>
              <th className="py-1.5 text-right">Meta</th>
              <th className="py-1.5 text-right">% Beneficio</th>
            </tr>
          </thead>
          <tbody>
            {scales.map((scale) => (
              <tr key={scale.level} className="border-b last:border-0">
                <td className="py-1.5">{scale.level}</td>
                <td className="py-1.5 text-right font-mono">
                  {scale.goal_unit === "units" ? `${scale.goal_value.toLocaleString("es-CO")} und` : formatCurrency(scale.goal_value)}
                </td>
                <td className="py-1.5 text-right font-mono">{scale.benefit_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modifiers.length > 0 && (
        <div className="mt-3 space-y-1">
          {modifiers.map((modifier, index) => (
            <p key={modifier.id ?? index} className="text-xs text-muted-foreground">
              {modifier.modifier_type === "penalty"
                ? `Penalización −${modifier.effect_pct ?? 0} pts`
                : `Tope ${modifier.cap_pct_over_goal ?? 0}% del objetivo`}
              {modifier.condition_text ? ` — ${modifier.condition_text}` : ""}
            </p>
          ))}
        </div>
      )}

      {fund.product_exclusions && (
        <p className="mt-2 text-xs text-amber-700">Exclusiones: {fund.product_exclusions}</p>
      )}

      {fundPeriods.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Períodos del fondo</p>
          <PeriodsTable periods={fundPeriods} />
        </div>
      )}
    </section>
  );
}

function PeriodsTable({ periods }: { periods: PlanPeriod[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs uppercase text-muted-foreground">
          <th className="py-1.5">Período</th>
          <th className="py-1.5">Rango</th>
          <th className="py-1.5 text-right">Meta</th>
          <th className="py-1.5 text-right">% Dist.</th>
        </tr>
      </thead>
      <tbody>
        {periods.map((period, index) => (
          <tr key={period.id ?? index} className="border-b last:border-0">
            <td className="py-1.5 font-medium">{period.label}</td>
            <td className="py-1.5 text-xs text-muted-foreground">
              {formatDate(period.start_date)} – {formatDate(period.end_date)}
            </td>
            <td className="py-1.5 text-right font-mono">
              {period.goal_value !== null ? formatCurrency(period.goal_value) : "—"}
            </td>
            <td className="py-1.5 text-right font-mono">
              {period.distribution_pct !== null ? `${period.distribution_pct}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ComplianceTab({ planId, enabled }: { planId: string; enabled: boolean }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["plan-compliance", planId],
    queryFn: () => getPlanCompliance(planId),
    enabled,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No se pudo calcular el cumplimiento del plan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <PlanMetric icon={Target} label="Ejecutado a la fecha" value={formatCurrency(data.executed_to_date)} note={`Corte: ${formatDate(data.cutoff_date)}`} />
        <PlanMetric icon={Percent} label="Cumplimiento" value={`${data.overall_compliance_pct.toFixed(1)}%`} note="Sobre meta prorrateada" />
        <PlanMetric icon={WalletCards} label="Meta total" value={formatCurrency(data.total_goal)} note="Objetivo del plan" />
      </div>

      {data.blocking_conditions_unmet.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {data.blocking_conditions_unmet.length} condición(es) bloqueante(s) incumplida(s): el rebate no se considera ganado.
        </div>
      )}

      <section className="rounded-md border bg-card p-4">
        <h3 className="mb-3 font-semibold">Avance por período</h3>
        <div className="space-y-3">
          {data.periods.map((period, index) => (
            <div key={period.id ?? index}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{period.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatCurrency(period.executed)} / {formatCurrency(period.goal_value)} ({period.compliance_pct.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${period.compliance_pct >= 100 ? "bg-green-500" : period.compliance_pct >= 70 ? "bg-primary" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(period.compliance_pct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border bg-card p-4">
        <h3 className="mb-3 font-semibold">Fondo ganado vs presupuestado</h3>
        <div className="space-y-2">
          {data.funds.map((fund) => {
            const statusConfig = FUND_STATUS_CONFIG[fund.status] || FUND_STATUS_CONFIG.pending;
            return (
              <div key={fund.fund_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{getConceptLabel(fund.concept)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fund.reached_level !== null ? `Escala nivel ${fund.reached_level} alcanzada` : "Escala no alcanzada"} ·
                    {" "}{fund.applied_pct}% aplicable
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">
                    <span className="font-bold">{formatCurrency(fund.earned)}</span>
                    <span className="text-muted-foreground"> / {formatCurrency(fund.budgeted)}</span>
                  </p>
                  <Badge variant="outline" className={statusConfig.className}>{statusConfig.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
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
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
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
