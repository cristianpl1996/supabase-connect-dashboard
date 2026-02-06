import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Server, Zap, RefreshCw, ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ExecutionWithDetails {
  id: string;
  erp_order_id: string | null;
  cost_impact: number | null;
  execution_date: string;
  is_billed_to_lab: boolean;
  promo_id: string | null;
  customer_id: string | null;
  customer_name?: string;
  customer_nit?: string;
  product_sku?: string;
  product_name?: string;
  promo_title?: string;
}

interface ActivePromotion {
  id: string;
  title: string;
  lab_id: string;
  mechanic?: {
    condition_type: string;
    condition_config: Record<string, unknown>;
    reward_type: string;
    reward_config: Record<string, unknown>;
  };
}

const MOCK_CUSTOMERS = [
  { id: "cust-001", name: "Agropecuaria El Rodeo S.A.", nit: "900.123.456-7" },
  { id: "cust-002", name: "Veterinaria La Mascota", nit: "800.987.654-3" },
  { id: "cust-003", name: "Distribuidora Ganadera del Norte", nit: "901.555.888-1" },
  { id: "cust-004", name: "PetShop Central", nit: "890.222.333-4" },
  { id: "cust-005", name: "Finca Los Alpes", nit: "900.777.999-2" },
];

const MOCK_PRODUCTS = [
  { sku: "VET-001", name: "Vacuna Triple Felina", price: 45000 },
  { sku: "VET-002", name: "Desparasitante Canino 10ml", price: 28000 },
  { sku: "GAN-001", name: "Antibiótico Bovino 500ml", price: 185000 },
  { sku: "GAN-002", name: "Vitamina ADE Inyectable", price: 72000 },
  { sku: "PET-001", name: "Alimento Premium Perro 15kg", price: 195000 },
];

export default function Middleware() {
  const [executions, setExecutions] = useState<ExecutionWithDetails[]>([]);
  const [activePromos, setActivePromos] = useState<ActivePromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [isOnline] = useState(true);

  const fetchExecutions = async () => {
    const { data, error } = await supabase
      .from("promo_executions")
      .select(`
        id,
        erp_order_id,
        cost_impact,
        execution_date,
        is_billed_to_lab,
        promo_id,
        customer_id,
        promotions (
          title
        )
      `)
      .order("execution_date", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching executions:", error);
      return;
    }

    // Enrich with mock data for display
    const enriched = (data || []).map((exec: any) => ({
      ...exec,
      promo_title: exec.promotions?.title || "Sin promoción",
      customer_name: MOCK_CUSTOMERS.find(c => c.id === exec.customer_id)?.name || `Cliente ${exec.customer_id?.slice(-4) || "N/A"}`,
      customer_nit: MOCK_CUSTOMERS.find(c => c.id === exec.customer_id)?.nit || "N/A",
      product_sku: MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)].sku,
      product_name: MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)].name,
    }));

    setExecutions(enriched);
    setLastSync(new Date());
    setLoading(false);
  };

  const fetchActivePromos = async () => {
    const today = new Date().toISOString().split("T")[0];
    
    const { data: promos } = await supabase
      .from("promotions")
      .select("id, title, lab_id")
      .eq("status", "activa")
      .lte("start_date", today)
      .gte("end_date", today);

    if (promos && promos.length > 0) {
      // Get mechanics for each promo
      const promoIds = promos.map(p => p.id);
      const { data: mechanics } = await supabase
        .from("promo_mechanics")
        .select("*")
        .in("promo_id", promoIds);

      const promosWithMechanics = promos.map(p => ({
        ...p,
        mechanic: mechanics?.find(m => m.promo_id === p.id),
      }));

      setActivePromos(promosWithMechanics);
    } else {
      setActivePromos([]);
    }
  };

  useEffect(() => {
    fetchExecutions();
    fetchActivePromos();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchExecutions();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const calculateBenefit = (
    promo: ActivePromotion,
    product: typeof MOCK_PRODUCTS[0],
    quantity: number
  ): { triggered: boolean; impact: number; description: string } => {
    if (!promo.mechanic) {
      return { triggered: false, impact: 0, description: "Sin mecánica definida" };
    }

    const { reward_type, reward_config } = promo.mechanic;
    const rewardValue = (reward_config as any)?.value || 0;

    switch (reward_type) {
      case "producto_gratis":
        // Free product: impact = product price * quantity given
        const freeQty = Math.floor(quantity / 3); // Example: buy 3 get 1
        if (freeQty > 0) {
          return {
            triggered: true,
            impact: product.price * freeQty,
            description: `${freeQty} unidad(es) gratis`,
          };
        }
        return { triggered: false, impact: 0, description: "No cumple mínimo" };

      case "descuento_porcentaje":
        const discount = (product.price * quantity * rewardValue) / 100;
        return {
          triggered: true,
          impact: discount,
          description: `${rewardValue}% de descuento`,
        };

      case "precio_especial":
        const normalTotal = product.price * quantity;
        const specialTotal = rewardValue * quantity;
        return {
          triggered: true,
          impact: normalTotal - specialTotal,
          description: `Precio especial: $${rewardValue.toLocaleString()}`,
        };

      default:
        return { triggered: false, impact: 0, description: "Tipo no reconocido" };
    }
  };

  const simulateSAPOrder = async () => {
    setSimulating(true);

    try {
      // Generate random order data
      const customer = MOCK_CUSTOMERS[Math.floor(Math.random() * MOCK_CUSTOMERS.length)];
      const product = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
      const quantity = Math.floor(Math.random() * 10) + 1;
      const docNum = `SAP-${Date.now().toString().slice(-8)}`;

      // Check if any active promo applies
      let triggered = false;
      let costImpact = 0;
      let appliedPromo: ActivePromotion | null = null;

      for (const promo of activePromos) {
        const result = calculateBenefit(promo, product, quantity);
        if (result.triggered) {
          triggered = true;
          costImpact = result.impact;
          appliedPromo = promo;
          break;
        }
      }

      // If no active promos, simulate random trigger for demo
      if (activePromos.length === 0) {
        triggered = Math.random() > 0.4; // 60% chance of triggering
        costImpact = triggered ? Math.floor(Math.random() * 50000) + 5000 : 0;
      }

      // Insert the execution record
      const { error } = await supabase.from("promo_executions").insert({
        promo_id: appliedPromo?.id || null,
        customer_id: customer.id,
        erp_order_id: docNum,
        cost_impact: costImpact,
        execution_date: new Date().toISOString(),
        is_billed_to_lab: false,
      });

      if (error) throw error;

      toast({
        title: "⚡ Pedido SAP Simulado",
        description: triggered
          ? `Orden ${docNum} - Promoción activada! Impacto: $${costImpact.toLocaleString()}`
          : `Orden ${docNum} - Sin promoción aplicable`,
      });

      // Refresh the table
      await fetchExecutions();
    } catch (error) {
      console.error("Error simulating order:", error);
      toast({
        title: "Error",
        description: "No se pudo simular el pedido",
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
    <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver al Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Middleware de Ejecución</h1>
              <p className="text-muted-foreground mt-1">Monitor de transacciones SAP Business One en tiempo real</p>
            </div>
            <Button onClick={simulateSAPOrder} disabled={simulating} className="gap-2">
              <Zap className="h-4 w-4" />
              {simulating ? "Procesando..." : "Simular Pedido SAP"}
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado de la API</CardTitle>
              <Server className={`h-4 w-4 ${isOnline ? "text-green-500" : "text-red-500"}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                <span className="text-lg font-semibold">
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Conexión SAP Business One
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Sincronización</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {formatDistanceToNow(lastSync, { addSuffix: true, locale: es })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-refresh cada 10 segundos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promociones Activas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{activePromos.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Listas para validar pedidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transacciones Procesadas</CardTitle>
                <CardDescription>Últimas 50 ejecuciones de promociones</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchExecutions} className="gap-2">
                <RefreshCw className="h-4 w-4" />
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
              <div className="text-center py-12">
                <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">Sin transacciones</h3>
                <p className="text-muted-foreground mb-4">
                  No hay ejecuciones registradas aún. Usa el botón de simular para probar el flujo.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID (SAP)</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">¿Activó Promo?</TableHead>
                    <TableHead className="text-right">Impacto Económico</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((exec) => (
                    <TableRow key={exec.id}>
                      <TableCell className="font-mono text-sm">
                        {exec.erp_order_id || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{exec.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{exec.customer_nit}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{exec.product_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{exec.product_sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {exec.promo_id ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            SÍ
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            NO
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {exec.cost_impact && exec.cost_impact > 0 ? (
                          <span className="text-amber-600">{formatCurrency(exec.cost_impact)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {format(new Date(exec.execution_date), "dd MMM yyyy", { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(exec.execution_date), "HH:mm:ss")}
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
