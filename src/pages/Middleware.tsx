import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, Clock, RefreshCw, Server, XCircle, Zap } from "lucide-react";

import {
  listActiveExecutionPromotions,
  listPromoExecutions,
  simulatePromoExecution,
  type ActivePromotionExecutionView,
  type PromoExecution,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { ErrorDisabledContent } from "@/components/common/ErrorDisabledContent";
import { PageHeader } from "@/components/common/PageHeader";

export default function Middleware() {
  const queryClient = useQueryClient();
  const [simulating, setSimulating] = useState(false);

  // ── Queries con polling cada 10s ───────────────────────────────────────────
  const {
    data: executions = [],
    isLoading: loading,
    isError,
    error: executionsError,
    isFetching: refreshing,
    refetch: refetchExecutions,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['promo-executions'],
    queryFn: listPromoExecutions,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const { data: activePromos = [] } = useQuery({
    queryKey: ['active-execution-promotions'],
    queryFn: listActiveExecutionPromotions,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const isOnline = !isError;
  const lastSync = new Date(dataUpdatedAt || Date.now());
  const error = isError ? (executionsError instanceof Error ? executionsError.message : 'Error de API') : null;

  // ── Mutación simulate ──────────────────────────────────────────────────────
  const simulateMutation = useMutation({
    mutationFn: simulatePromoExecution,
    onSuccess: (result) => {
      const amount = result.execution.cost_impact ?? 0;
      toast({
        title: "Pedido SAP simulado",
        description: result.triggered
          ? `Orden ${result.erp_order_id} - Promocion activada por ${formatCurrency(amount)}.`
          : `Orden ${result.erp_order_id} - ${result.description}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['promo-executions'] });
    },
    onError: () => {
      toast({ title: "Error de API", description: "No se pudo simular el pedido en el middleware.", variant: "destructive" });
    },
    onSettled: () => setSimulating(false),
  });

  const simulateSAPOrder = () => {
    setSimulating(true);
    simulateMutation.mutate();
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === 0) return "-";
    return `$${value.toLocaleString("es-CO")}`;
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <ErrorDisabledContent disabled={!!error}>
      <div className="mb-8">
        <Link to="/" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 size-4" />
          Volver al Dashboard
        </Link>
        <PageHeader
          icon={Server}
          title="Middleware de Ejecucion"
          description="Monitor de pedidos simulados y ejecuciones promocionales desde la API."
          actions={(
          <Button onClick={simulateSAPOrder} disabled={simulating} className="gap-2">
            <Zap className="size-4" />
            {simulating ? "Procesando…" : "Simular Pedido SAP"}
          </Button>
          )}
        />
      </div>
      </ErrorDisabledContent>

      {error && (
        <ModuleErrorCard message={error} onRetry={() => void refetchExecutions()} loading={refreshing || loading} />
      )}

      <ErrorDisabledContent disabled={!!error} className="space-y-6">
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado de la API</CardTitle>
            <Server className={`h-4 w-4 ${isOnline ? "text-green-500" : "text-red-500"}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <span className="text-lg font-semibold">{isOnline ? "ONLINE" : "OFFLINE"}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Conectado a los endpoints del middleware</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ultima sincronizacion</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {formatDistanceToNow(lastSync, { addSuffix: true, locale: es })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Auto-refresh cada 10 segundos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promociones activas</CardTitle>
            <CheckCircle2 className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{activePromos.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Listas para evaluar pedidos simulados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transacciones Procesadas</CardTitle>
              <CardDescription>Ultimas 50 ejecuciones registradas por el backend</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetchExecutions()} className="gap-2" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="py-12 text-center">
              <Server className="mx-auto mb-4 size-12 text-muted-foreground" />
              <h3 className="mb-1 text-lg font-semibold">Sin transacciones</h3>
              <p className="mb-4 text-muted-foreground">
                No hay ejecuciones registradas aun. Usa el boton de simular para probar el flujo.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID (SAP)</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Activo promo</TableHead>
                  <TableHead className="text-right">Impacto economico</TableHead>
                  <TableHead>Fecha/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-mono text-sm">
                      {execution.erp_order_id || "N/A"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{execution.customer_name || "Cliente no identificado"}</p>
                        <p className="text-xs text-muted-foreground">{execution.customer_nit || "N/A"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{execution.product_name || "Producto no identificado"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{execution.product_sku || "N/A"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {execution.promo_id ? (
                        <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
                          <CheckCircle2 className="mr-1 size-3" />
                          SI
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 size-3" />
                          NO
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {execution.cost_impact && execution.cost_impact > 0 ? (
                        <span className="text-amber-600">{formatCurrency(execution.cost_impact)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">
                          {format(new Date(execution.execution_date), "dd MMM yyyy", { locale: es })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(execution.execution_date), "HH:mm:ss")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </ErrorDisabledContent>
    </div>
  );
}
