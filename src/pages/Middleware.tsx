import { useEffect, useState } from "react";
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

export default function Middleware() {
  const [executions, setExecutions] = useState<PromoExecution[]>([]);
  const [activePromos, setActivePromos] = useState<ActivePromotionExecutionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(true);

  const fetchExecutions = async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
    }

    try {
      const data = await listPromoExecutions();
      setExecutions(data);
      setIsOnline(true);
      setLastSync(new Date());
    } catch (error) {
      console.error("Error fetching executions from API:", error);
      setIsOnline(false);
      if (!silent) {
        toast({
          title: "Error de API",
          description: "No se pudieron cargar las ejecuciones del middleware.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      if (!silent) {
        setRefreshing(false);
      }
    }
  };

  const fetchActivePromos = async () => {
    try {
      const data = await listActiveExecutionPromotions();
      setActivePromos(data);
      setIsOnline(true);
    } catch (error) {
      console.error("Error fetching active promotions from API:", error);
      setIsOnline(false);
    }
  };

  const refreshData = async (silent = false) => {
    await Promise.all([fetchExecutions(silent), fetchActivePromos()]);
  };

  useEffect(() => {
    void refreshData();

    const interval = window.setInterval(() => {
      void refreshData(true);
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  const simulateSAPOrder = async () => {
    setSimulating(true);

    try {
      const result = await simulatePromoExecution();
      const amount = result.execution.cost_impact ?? 0;

      toast({
        title: "Pedido SAP simulado",
        description: result.triggered
          ? `Orden ${result.erp_order_id} - Promocion activada por ${formatCurrency(amount)}.`
          : `Orden ${result.erp_order_id} - ${result.description}.`,
      });

      await refreshData(true);
    } catch (error) {
      console.error("Error simulating middleware order:", error);
      setIsOnline(false);
      toast({
        title: "Error de API",
        description: "No se pudo simular el pedido en el middleware.",
        variant: "destructive",
      });
    } finally {
      setSimulating(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === 0) return "-";
    return `$${value.toLocaleString("es-CO")}`;
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div className="mb-8">
        <Link to="/" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver al Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Middleware de Ejecucion</h1>
            <p className="mt-1 text-muted-foreground">Monitor de pedidos simulados y ejecuciones promocionales desde la API.</p>
          </div>
          <Button onClick={simulateSAPOrder} disabled={simulating} className="gap-2">
            <Zap className="h-4 w-4" />
            {simulating ? "Procesando..." : "Simular Pedido SAP"}
          </Button>
        </div>
      </div>

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
            <Clock className="h-4 w-4 text-muted-foreground" />
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
            <CheckCircle2 className="h-4 w-4 text-green-500" />
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
            <Button variant="outline" size="sm" onClick={() => void refreshData()} className="gap-2" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="py-12 text-center">
              <Server className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
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
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          SI
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" />
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
    </div>
  );
}
