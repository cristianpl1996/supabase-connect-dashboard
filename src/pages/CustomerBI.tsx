import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  History,
  LineChart,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import {
  CustomerBIData,
  CustomerBIProduct,
  CustomerNameItem,
  getCustomerBI,
  searchCustomerNames,
} from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { addMonths, periodDelta, productShareData } from "@/lib/customerBI";

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const NUMBER = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const MONTH = new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });
const DATE = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
const PRODUCT_COLORS = ["#169c55", "#22c55e", "#60a5fa", "#f59e0b", "#a78bfa", "#94a3b8"];

function currentMonth() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return COP.format(numeric(value));
}

function formatMonth(value: string) {
  return MONTH.format(new Date(`${value}-01T00:00:00Z`)).replace(".", "");
}

function formatDate(value: string | null | undefined) {
  return value ? DATE.format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : "Sin compras";
}

function text(record: Record<string, unknown>, key: string, fallback = "N/A") {
  const value = record[key];
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function formatDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${NUMBER.format(value * 100)}%`;
}

function presetRange(months: number) {
  const end = currentMonth();
  return { from: addMonths(end, -(months - 1)), to: end };
}

const SEARCH_LIMIT = 50;

export default function CustomerBI() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCustomer = searchParams.get("customerId") ?? "all";
  const initialRange = presetRange(12);
  const [customerId, setCustomerId] = useState(initialCustomer);
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? initialRange.from);
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? initialRange.to);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const [productMetric, setProductMetric] = useState<"revenue" | "units">("revenue");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerNameItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    setSearchLoading(true);
    setSearchOffset(0);
    searchCustomerNames(debouncedSearch, SEARCH_LIMIT, 0)
      .then((res) => {
        setSearchResults(res.data);
        setSearchTotal(res.meta?.count ?? res.data.length);
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false));
  }, [debouncedSearch, dropdownOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasMore = searchResults.length < searchTotal;

  const handleLoadMore = async () => {
    const nextOffset = searchOffset + SEARCH_LIMIT;
    setLoadingMore(true);
    try {
      const res = await searchCustomerNames(debouncedSearch, SEARCH_LIMIT, nextOffset);
      setSearchResults((prev) => [...prev, ...res.data]);
      setSearchOffset(nextOffset);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const list = dropdownListRef.current;
    if (!sentinel || !list || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) void handleLoadMore(); },
      { root: list, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, searchResults.length]);

  const biQuery = useQuery({
    queryKey: ["customer-bi", customerId, dateFrom, dateTo],
    queryFn: () => getCustomerBI(Number(customerId), dateFrom, dateTo),
    enabled: customerId !== "all" && Number.isFinite(Number(customerId)),
    staleTime: 60_000,
  });

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value.trim()), 300);
  };

  const handleSelectCustomer = (customer: CustomerNameItem) => {
    setCustomerId(String(customer.id));
    const next = new URLSearchParams(searchParams);
    next.set("customerId", String(customer.id));
    setSearchParams(next, { replace: true });
    setDropdownOpen(false);
    setSearchInput("");
    setDebouncedSearch("");
    setSearchResults([]);
  };

  const handleClearCustomer = () => {
    setCustomerId("all");
    const next = new URLSearchParams(searchParams);
    next.delete("customerId");
    setSearchParams(next, { replace: true });
    setSearchInput("");
    setDebouncedSearch("");
    setSearchResults([]);
  };

  const selectedLabel = biQuery.data
    ? `${biQuery.data.customer.customer_full_name ?? "Cliente"} · ${biQuery.data.customer.customer_government_id ?? ""}`
    : customerId !== "all" ? "Cargando..." : null;


  const applyRange = (from: string, to: string) => {
    setDraftFrom(from);
    setDraftTo(to);
    setDateFrom(from);
    setDateTo(to);
    const next = new URLSearchParams(searchParams);
    next.set("dateFrom", from);
    next.set("dateTo", to);
    setSearchParams(next, { replace: true });
  };

  const applyPreset = (months: number) => {
    const range = presetRange(months);
    applyRange(range.from, range.to);
  };

  const applyAllHistory = () => {
    const first = biQuery.data?.lifetime_summary.first_purchase_date?.slice(0, 7);
    applyRange(first || "2025-01", currentMonth());
  };

  const data = biQuery.data;

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <PageHeader
        icon={LineChart}
        title="Análisis de Clientes"
        description="Analiza ventas, comportamiento de compra y oportunidades por cliente."
        actions={customerId !== "all" ? (
          <Button variant="outline" asChild className="w-full gap-2 md:w-auto">
            <Link to={`/customers?customerId=${customerId}`}><ArrowLeft className="size-4" /> Volver al perfil</Link>
          </Button>
        ) : undefined}
      />

      <Card className="border-primary/15 shadow-sm">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(280px,1.4fr)_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            {customerId !== "all" ? (
              <div className="flex h-10 items-center gap-2 rounded-md border bg-primary/5 px-3 text-sm">
                <span className="flex-1 truncate font-medium">{selectedLabel}</span>
                <button type="button" onClick={handleClearCustomer} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" title="Cambiar cliente">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Buscar por Cliente o NIT"
                    className="pl-9"
                  />
                </div>
                {dropdownOpen && (
                  <div ref={dropdownListRef} className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border bg-popover shadow-md">
                    {searchLoading && searchResults.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Buscando...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        {debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : "Escribe para buscar un cliente"}
                      </p>
                    ) : (
                      <>
                        {searchResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer)}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-accent"
                          >
                            <span className="mr-4 truncate font-medium">{customer.customer_full_name ?? "Sin nombre"}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{customer.customer_government_id}</span>
                          </button>
                        ))}
                        <div ref={sentinelRef} className="flex items-center justify-center py-2">
                          {loadingMore && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bi-date-from">Mes inicial</Label>
              <Input id="bi-date-from" type="month" value={draftFrom} max={draftTo} disabled={customerId === "all"} onChange={(event) => setDraftFrom(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-date-to">Mes final</Label>
              <Input id="bi-date-to" type="month" value={draftTo} min={draftFrom} max={currentMonth()} disabled={customerId === "all"} onChange={(event) => setDraftTo(event.target.value)} />
            </div>
          </div>
          <Button onClick={() => applyRange(draftFrom, draftTo)} disabled={customerId === "all" || !draftFrom || !draftTo || draftFrom > draftTo}>
            Aplicar periodo
          </Button>
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            {[3, 6, 12].map((months) => (
              <Button key={months} type="button" size="sm" variant="outline" disabled={customerId === "all"} onClick={() => applyPreset(months)}>
                {months} meses
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={applyAllHistory} disabled={customerId === "all" || !data}>
              Todo el historico
            </Button>
            {data && (
              <span className="ml-auto self-center text-xs text-muted-foreground">
                Comparado con {formatMonth(data.period.previous_date_from)} a {formatMonth(data.period.previous_date_to)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {customerId === "all" && <EmptySelection />}
      {biQuery.isLoading && customerId !== "all" && <LoadingDashboard />}
      {biQuery.error && (
        <ModuleErrorCard
          title="No fue posible cargar el análisis del cliente"
          message={biQuery.error instanceof Error ? biQuery.error.message : "Error inesperado"}
          onRetry={() => void biQuery.refetch()}
        />
      )}
      {data && !biQuery.isLoading && <Dashboard data={data} productMetric={productMetric} onProductMetricChange={setProductMetric} />}
    </div>
  );
}

function Dashboard({
  data,
  productMetric,
  onProductMetricChange,
}: {
  data: CustomerBIData;
  productMetric: "revenue" | "units";
  onProductMetricChange: (value: "revenue" | "units") => void;
}) {
  const { customer, summary, previous_period_summary: previous, lifetime_summary: lifetime } = data;
  const hasPeriodData = numeric(summary.total_purchases) > 0;
  const sortedProducts = [...data.top_products].sort((a, b) =>
    productMetric === "revenue"
      ? numeric(b.total_revenue) - numeric(a.total_revenue)
      : numeric(b.total_units) - numeric(a.total_units),
  );
  const pieData = productShareData(sortedProducts, productMetric);

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.08] via-background to-background">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge>{customer.customer_is_valid === false ? "Inactivo" : "Activo"}</Badge>
              {customer.customer_clv_segment && <Badge variant="outline">CLV {text(customer, "customer_clv_segment")}</Badge>}
              {customer.customer_rfm_segment && <Badge variant="outline">{text(customer, "customer_rfm_segment")}</Badge>}
              {customer.cluster && <Badge variant="secondary">{text(customer, "cluster")}</Badge>}
            </div>
            <h2 className="text-2xl font-bold">{text(customer, "customer_full_name", "Cliente sin nombre")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {text(customer, "customer_government_id")} · {text(customer, "customer_business_type")} · {text(customer, "customer_business_city")}
            </p>
          </div>
          <div className="grid gap-1 text-sm lg:text-right">
            <span className="font-medium">{text(customer, "sales_rep_full_name", "Sin representante")}</span>
            <span className="text-muted-foreground">{text(customer, "sales_rep_coverage_area", "Sin zona asignada")}</span>
            <span className="text-xs text-muted-foreground">Periodo: {formatMonth(data.period.date_from)} a {formatMonth(data.period.date_to)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={CircleDollarSign} label="Ventas del periodo" value={money(summary.total_revenue)} change={periodDelta(summary.total_revenue, previous.total_revenue)} />
        <MetricCard icon={ReceiptText} label="Compras / facturas" value={NUMBER.format(numeric(summary.total_purchases))} change={periodDelta(summary.total_purchases, previous.total_purchases)} />
        <MetricCard icon={Package} label="Unidades" value={NUMBER.format(numeric(summary.total_units))} change={periodDelta(summary.total_units, previous.total_units)} />
        <MetricCard icon={ShoppingCart} label="Ticket promedio" value={money(summary.average_ticket)} change={periodDelta(summary.average_ticket, previous.average_ticket)} />
        <MetricCard icon={CalendarDays} label="Ultima compra" value={formatDate(summary.last_purchase_date)} />
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <LifetimeMetric label="Ingresos historicos" value={money(lifetime.total_revenue)} />
          <LifetimeMetric label="Compras historicas" value={NUMBER.format(numeric(lifetime.total_purchases))} />
          <LifetimeMetric label="Ticket promedio histórico" value={money(lifetime.average_ticket)} />
        </CardContent>
      </Card>

      {!hasPeriodData ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-52 flex-col items-center justify-center text-center">
            <CalendarDays className="size-10 text-muted-foreground/40" />
            <h3 className="mt-3 font-semibold">No hay ventas en este periodo</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Prueba un rango más amplio o usa “Todo el historico”. Los indicadores históricos permanecen disponibles arriba.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4 text-primary" /> Evolucion mensual</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={330}>
                  <ComposedChart data={data.monthly_series} margin={{ left: 4, right: 8 }}>
                    <defs>
                      <linearGradient id="biRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#169c55" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#169c55" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="sale_month" tickFormatter={formatMonth} minTickGap={24} />
                    <YAxis yAxisId="money" tickFormatter={(value) => compactMoney(value)} width={72} />
                    <YAxis yAxisId="units" orientation="right" width={45} />
                    <Tooltip content={<SalesTooltip />} />
                    <Legend />
                    <Area yAxisId="money" type="monotone" dataKey="revenue" name="Ventas" stroke="#169c55" fill="url(#biRevenue)" strokeWidth={2} />
                    <Bar yAxisId="units" dataKey="purchases" name="Facturas" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="units" type="monotone" dataKey="units" name="Unidades" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-primary" /> Participacion de productos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {pieData.map((item, index) => <Cell key={item.name} fill={PRODUCT_COLORS[index % PRODUCT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => productMetric === "revenue" ? money(value) : NUMBER.format(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.slice(0, 4).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PRODUCT_COLORS[index] }} /><span className="truncate">{item.name}</span></span>
                      <span className="font-medium">{NUMBER.format(item.share * 100)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InsightCard icon={Sparkles} label="Mejor mes" value={data.insights.best_month ? formatMonth(data.insights.best_month.sale_month) : "Sin datos"} note={data.insights.best_month ? money(data.insights.best_month.revenue) : undefined} />
            <InsightCard icon={Activity} label="Meses con actividad" value={`${data.insights.active_months} de ${data.period.month_count}`} note="Meses con ventas registradas" />
            <InsightCard icon={RefreshCw} label="Frecuencia" value={data.insights.purchases_per_active_month === null ? "Sin datos" : `${NUMBER.format(data.insights.purchases_per_active_month)} compras/mes`} note="Promedio en meses activos" />
            <InsightCard icon={TrendingUp} label="Tendencia reciente" value={formatDelta(data.insights.recent_trend)} note={data.insights.opportunity} tone={data.insights.recent_trend < 0 ? "danger" : "success"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base"><Package className="size-4 text-primary" /> Productos mas comprados</CardTitle>
                <Tabs value={productMetric} onValueChange={(value) => onProductMetricChange(value as "revenue" | "units")}>
                  <TabsList className="h-8">
                    <TabsTrigger value="revenue" className="h-7 text-xs">Ingresos</TabsTrigger>
                    <TabsTrigger value="units" className="h-7 text-xs">Unidades</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedProducts.slice(0, 8).map((product, index) => (
                  <ProductRow key={`${product.product_sku}-${index}`} product={product} index={index} metric={productMetric} max={productMetric === "revenue" ? numeric(sortedProducts[0]?.total_revenue) : numeric(sortedProducts[0]?.total_units)} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="size-4 text-primary" /> Compras recientes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Factura</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Und.</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.recent_purchases.slice(0, 10).map((purchase) => (
                        <TableRow key={purchase.commercial_sale_id}>
                          <TableCell><div className="font-medium">{purchase.sale_invoice_number || `#${purchase.commercial_sale_id}`}</div><div className="text-xs text-muted-foreground">{purchase.product_count} productos</div></TableCell>
                          <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                          <TableCell className="text-right font-medium">{money(purchase.total_revenue)}</TableCell>
                          <TableCell className="text-right">{NUMBER.format(numeric(purchase.total_units))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function MetricCard({ icon: Icon, label, value, change }: { icon: React.ElementType; label: string; value: string; change?: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 truncate text-xl font-bold">{value}</p></div>
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span>
        </div>
        {change !== undefined && (
          <div className={cn("mt-3 flex items-center gap-1 text-xs font-medium", change >= 0 ? "text-emerald-600" : "text-red-600")}>
            {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {formatDelta(change)} vs. periodo anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LifetimeMetric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3"><History className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div></div>;
}

function InsightCard({ icon: Icon, label, value, note, tone = "default" }: { icon: React.ElementType; label: string; value: string; note?: string; tone?: "default" | "success" | "danger" }) {
  return (
    <Card className={cn(tone === "success" && "border-emerald-200 bg-emerald-50/40", tone === "danger" && "border-red-200 bg-red-50/40")}>
      <CardContent className="flex gap-3 p-4"><Icon className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p>{note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}</div></CardContent>
    </Card>
  );
}

function ProductRow({ product, index, metric, max }: { product: CustomerBIProduct; index: number; metric: "revenue" | "units"; max: number }) {
  const value = metric === "revenue" ? numeric(product.total_revenue) : numeric(product.total_units);
  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
      <div className="min-w-0">
        <div className="flex justify-between gap-3"><p className="truncate text-sm font-medium">{product.product_commercial_name || product.product_sku || "Producto"}</p><span className="shrink-0 text-sm font-semibold">{metric === "revenue" ? money(value) : NUMBER.format(value)}</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.max(4, value / max * 100) : 0}%` }} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{product.product_brand_name || "Sin marca"} · {product.purchase_count} compras</p>
      </div>
      <span />
    </div>
  );
}

function compactMoney(value: number) {
  if (value >= 1_000_000_000) return `$${NUMBER.format(value / 1_000_000_000)} mil M`;
  if (value >= 1_000_000) return `$${NUMBER.format(value / 1_000_000)} M`;
  if (value >= 1_000) return `$${NUMBER.format(value / 1_000)} mil`;
  return `$${value}`;
}

function SalesTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold">{label ? formatMonth(label) : ""}</p>
      {payload.map((item) => <div key={item.name} className="flex min-w-40 justify-between gap-4 py-0.5"><span style={{ color: item.color }}>{item.name}</span><span className="font-medium">{item.name === "Ventas" ? money(item.value) : NUMBER.format(item.value)}</span></div>)}
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
      <Users className="size-10 text-muted-foreground/50" />
      <p className="text-muted-foreground">Selecciona un cliente para ver su análisis comercial</p>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
        <div className="h-72 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
