import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardSummary, getDashboardSummary } from "@/lib/api";
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

const Index = () => {
  const navigate = useNavigate();
  const {
    data: dashboard,
    isLoading: loading,
    error,
  } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

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

  const kpis = dashboard?.kpis ?? {
    total_budget_managed: 0,
    active_promotions_count: 0,
    total_promotions_count: 0,
    total_committed: 0,
    execution_percentage: 0,
    active_plans_count: 0,
  };
  const expiringPromos = dashboard?.expiring_promotions ?? [];
  const criticalLabs = dashboard?.critical_laboratories ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inicio - Dashboard</h1>
        <p className="text-muted-foreground">
          Panorama general de todos los laboratorios •{" "}
          {new Date().toLocaleDateString("es-CO", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">Error de Conexion</p>
                <p className="text-sm text-destructive/90">
                  {error instanceof Error ? error.message : "Error desconocido"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Presupuesto Total Gestionado</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(kpis.total_budget_managed)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.active_plans_count} contrato{kpis.active_plans_count !== 1 ? "s" : ""} activo{kpis.active_plans_count !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Promociones Activas</CardTitle>
            <Tag className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{kpis.active_promotions_count}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.total_promotions_count} promociones en total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ejecucion Presupuestal</CardTitle>
            <Percent className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">{Math.round(kpis.execution_percentage)}%</p>
              <span className="text-sm text-muted-foreground mb-1">ejecutado</span>
            </div>
            <Progress value={kpis.execution_percentage} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {formatCurrency(kpis.total_committed)} de {formatCurrency(kpis.total_budget_managed)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Promociones por Vencer</CardTitle>
            </div>
            <CardDescription>Promociones que terminan en los proximos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringPromos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No hay promociones por vencer esta semana</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringPromos.slice(0, 5).map((promo) => (
                  <div
                    key={promo.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => navigate("/promotions")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{promo.title}</p>
                      <p className="text-sm text-muted-foreground">{promo.laboratory_name || "Laboratorio"}</p>
                    </div>
                    <Badge variant={promo.days_left <= 2 ? "destructive" : "secondary"} className="ml-2 shrink-0">
                      {promo.days_left === 0 ? "Hoy" : promo.days_left === 1 ? "Manana" : `${promo.days_left} dias`}
                    </Badge>
                  </div>
                ))}
                {expiringPromos.length > 5 && (
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/promotions")}>
                    Ver {expiringPromos.length - 5} mas <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Semaforo de Presupuesto</CardTitle>
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
                    key={lab.lab_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors cursor-pointer"
                    onClick={() => navigate("/wallet")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{lab.lab_name}</p>
                      <p className="text-sm text-muted-foreground">Disponible: {formatCurrency(lab.available_balance)}</p>
                    </div>
                    <Badge variant="destructive" className="ml-2 shrink-0">
                      {Math.max(0, Math.round(lab.percentage))}%
                    </Badge>
                  </div>
                ))}
                {criticalLabs.length > 5 && (
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => navigate("/wallet")}>
                    Ver {criticalLabs.length - 5} mas <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accesos Rapidos</CardTitle>
          <CardDescription>Acciones mas comunes</CardDescription>
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

      <div className="text-xs text-muted-foreground text-center">
        Ultima actualizacion: {new Date().toLocaleTimeString("es-CO")} • Conectado a la API
      </div>
    </div>
  );
};

export default Index;
