import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AnnualPlan, Promotion, Laboratory, PlanFund } from "@/types/database";
import { fetchBudgetRulesConfig, isFundSpendable, BudgetRulesConfig } from "@/hooks/useBudgetRules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  TrendingUp,
  Tag,
  Percent,
  Clock,
  AlertTriangle,
  Rocket,
  FileText,
  Megaphone,
  ArrowRight,
} from "lucide-react";

interface WalletLedgerEntry {
  id: string;
  lab_id: string;
  type: "ingreso" | "egreso";
  amount: number;
}

interface LabBudgetStatus {
  lab_id: string;
  lab_name: string;
  budget: number;
  committed: number;
  adjustments: number;
  available: number;
  percentage: number;
}

const Index = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<WalletLedgerEntry[]>([]);
  const [planFunds, setPlanFunds] = useState<PlanFund[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRulesConfig>({});
  const [spendableBudget, setSpendableBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [plansRes, promosRes, labsRes, ledgerRes, fundsRes, rulesConfig] = await Promise.all([
        supabase.from("annual_plans").select("*"),
        supabase.from("promotions").select("*"),
        supabase.from("laboratories").select("*"),
        supabase.from("wallet_ledger").select("*"),
        supabase.from("plan_funds").select("*"),
        fetchBudgetRulesConfig(),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (promosRes.error) throw promosRes.error;
      if (labsRes.error) throw labsRes.error;

      const allPlans = plansRes.data || [];
      const allFunds = fundsRes.data || [];

      setPlans(allPlans);
      setPromotions(promosRes.data || []);
      setLaboratories(labsRes.data || []);
      setLedgerEntries(ledgerRes.data || []);
      setPlanFunds(allFunds);
      setBudgetRules(rulesConfig);

      // Calculate global spendable budget
      const purchaseGoals: Record<string, number> = {};
      allPlans.forEach((p) => { purchaseGoals[p.id] = p.total_purchase_goal || 0; });

      let totalSpendable = 0;
      allFunds.forEach((fund: PlanFund) => {
        if (isFundSpendable(rulesConfig, fund.concept, fund.amount_type)) {
          if (fund.amount_type === 'fijo') {
            totalSpendable += fund.amount_value || 0;
          } else {
            totalSpendable += ((purchaseGoals[fund.plan_id] || 0) * (fund.amount_value || 0)) / 100;
          }
        }
      });
      setSpendableBudget(totalSpendable);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getLabName = (labId: string) => {
    return laboratories.find((l) => l.id === labId)?.name || "Laboratorio";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // KPI Calculations — use spendable budget from budget_rules
  const totalBudget = spendableBudget;

  const activePromos = promotions.filter((p) => p.status === "activa");
  const activePromosCount = activePromos.length;

  const totalCommitted = promotions
    .filter((p) => p.status === "activa" || p.status === "borrador")
    .reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  const executionPercentage = totalBudget > 0 ? Math.round((totalCommitted / totalBudget) * 100) : 0;

  // Promos expiring in next 7 days
  const today = new Date();
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expiringPromos = promotions
    .filter((p) => {
      if (p.status !== "activa" || !p.end_date) return false;
      const endDate = new Date(p.end_date);
      return endDate >= today && endDate <= sevenDaysFromNow;
    })
    .sort((a, b) => new Date(a.end_date!).getTime() - new Date(b.end_date!).getTime());

  // Labs with less than 10% available budget
  const labBudgets: LabBudgetStatus[] = [];
  const uniqueLabIds = [...new Set(plans.map((p) => p.lab_id))];

  uniqueLabIds.forEach((labId) => {
    const labPlans = plans.filter((p) => p.lab_id === labId);
    const labPlanIds = labPlans.map((p) => p.id);
    const labFunds = planFunds.filter((f) => labPlanIds.includes(f.plan_id));
    const labPromos = promotions.filter(
      (p) => p.lab_id === labId && (p.status === "activa" || p.status === "borrador"),
    );
    const labLedger = ledgerEntries.filter((e) => e.lab_id === labId);

    // Calculate spendable budget for this lab using budget_rules
    const purchaseGoals: Record<string, number> = {};
    labPlans.forEach((p) => { purchaseGoals[p.id] = p.total_purchase_goal || 0; });

    let budget = 0;
    labFunds.forEach((fund) => {
      if (isFundSpendable(budgetRules, fund.concept, fund.amount_type)) {
        if (fund.amount_type === 'fijo') {
          budget += fund.amount_value || 0;
        } else {
          budget += ((purchaseGoals[fund.plan_id] || 0) * (fund.amount_value || 0)) / 100;
        }
      }
    });

    const committed = labPromos.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
    const adjustments = labLedger.reduce((sum, e) => {
      return e.type === "ingreso" ? sum + e.amount : sum - e.amount;
    }, 0);

    const available = budget + adjustments - committed;
    const percentage = budget > 0 ? (available / budget) * 100 : 0;

    labBudgets.push({
      lab_id: labId,
      lab_name: getLabName(labId),
      budget,
      committed,
      adjustments,
      available,
      percentage,
    });
  });

  const criticalLabs = labBudgets
    .filter((l) => l.percentage < 10 && l.budget > 0)
    .sort((a, b) => a.percentage - b.percentage);

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inicio - Dashboard</h1>
        <p className="text-muted-foreground">
          Panorama general de todos los laboratorios •{" "}
          {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">Error de Conexión</p>
                <p className="text-sm text-destructive/90">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NIVEL 1: KPIs Globales */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Presupuesto Total Gestionado</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalBudget)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {plans.length} contrato{plans.length !== 1 ? "s" : ""} activo{plans.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Promociones Activas</CardTitle>
            <Tag className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activePromosCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{promotions.length} promociones en total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ejecución Presupuestal</CardTitle>
            <Percent className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{executionPercentage}%</p>
              <span className="text-sm text-muted-foreground mb-1">ejecutado</span>
            </div>
            <Progress value={executionPercentage} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {formatCurrency(totalCommitted)} de {formatCurrency(totalBudget)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 2: Alertas y Atención */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Promociones por Vencer */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Promociones por Vencer</CardTitle>
            </div>
            <CardDescription>Promociones que terminan en los próximos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringPromos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No hay promociones por vencer esta semana</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringPromos.slice(0, 5).map((promo) => {
                  const daysLeft = getDaysUntil(promo.end_date!);
                  return (
                    <div
                      key={promo.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate("/promotions")}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{promo.title}</p>
                        <p className="text-sm text-muted-foreground">{getLabName(promo.lab_id)}</p>
                      </div>
                      <Badge variant={daysLeft <= 2 ? "destructive" : "secondary"} className="ml-2 shrink-0">
                        {daysLeft === 0 ? "Hoy" : daysLeft === 1 ? "Mañana" : `${daysLeft} días`}
                      </Badge>
                    </div>
                  );
                })}
                {expiringPromos.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => navigate("/promotions")}
                  >
                    Ver {expiringPromos.length - 5} más <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Semáforo de Presupuesto */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Semáforo de Presupuesto</CardTitle>
            </div>
            <CardDescription>Laboratorios con menos del 10% de saldo disponible</CardDescription>
          </CardHeader>
          <CardContent>
            {criticalLabs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Todos los laboratorios tienen saldo suficiente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {criticalLabs.slice(0, 5).map((lab) => (
                  <div
                    key={lab.lab_name}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors cursor-pointer"
                    onClick={() => navigate("/wallet")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lab.lab_name}</p>
                      <p className="text-sm text-muted-foreground">Disponible: {formatCurrency(lab.available)}</p>
                    </div>
                    <Badge variant="destructive" className="ml-2 shrink-0">
                      {Math.max(0, Math.round(lab.percentage))}%
                    </Badge>
                  </div>
                ))}
                {criticalLabs.length > 5 && (
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/wallet")}>
                    Ver {criticalLabs.length - 5} más <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NIVEL 3: Accesos Rápidos */}
      <Card>
        <CardHeader>
          <CardTitle>Accesos Rápidos</CardTitle>
          <CardDescription>Acciones más comunes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-primary hover:text-primary-foreground transition-all"
              onClick={() => navigate("/promotions")}
            >
              <Rocket className="h-8 w-8" />
              <span className="font-semibold">Nueva Promo</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-primary hover:text-primary-foreground transition-all"
              onClick={() => navigate("/plans")}
            >
              <FileText className="h-8 w-8" />
              <span className="font-semibold">Cargar Contrato</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-primary hover:text-primary-foreground transition-all"
              onClick={() => navigate("/marketing")}
            >
              <Megaphone className="h-8 w-8" />
              <span className="font-semibold">Crear Arte</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center">
        Última actualización: {new Date().toLocaleTimeString("es-CO")} • Conectado a Supabase
      </div>
    </div>
  );
};

export default Index;

