import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  CustomerParams,
  CustomerRecord,
  CustomerTopProduct,
  getCustomersPage,
  listTotal,
  SaleRecord,
  TracingRecord,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building2,
  Copy,
  Eye,
  Filter,
  Loader2,
  Mail,
  MapPinned,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 200;

const FIELD_LABELS: Record<string, string> = {
  id: "ID interno",
  distributor_id: "Distribuidor",
  sales_representative_id: "ID representante",
  sales_rep_full_name: "Representante",
  sales_rep_coverage_area: "Zona representante",
  customer_government_id: "Documento / NIT",
  customer_full_name: "Nombre del cliente",
  customer_business_type: "Tipo de negocio",
  customer_cellphone: "Celular",
  customer_cellphone_country_dial_code: "Indicativo",
  customer_email: "Email",
  customer_business_address: "Direccion comercial",
  customer_age_range: "Rango de edad",
  customer_biological_sex: "Sexo biologico",
  customer_wallet_confirmation_email: "Email de billetera",
  customer_external_integration_id: "ID integracion externa",
  customer_business_city: "Ciudad",
  customer_business_state: "Departamento",
  customer_business_latitude: "Latitud",
  customer_business_longitude: "Longitud",
  customer_total_lifetime_revenue: "Ingresos acumulados",
  customer_total_number_of_purchases: "Compras realizadas",
  customer_average_purchase_ticket_amount: "Ticket promedio",
  customer_days_since_last_purchase: "Dias desde ultima compra",
  created_at: "Creado",
  updated_at: "Actualizado",
};

const CORE_CUSTOMER_FIELDS = new Set(Object.keys(FIELD_LABELS));

function field(record: Record<string, unknown> | null | undefined, key: string, fallback = "N/A") {
  const value = record?.[key];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function labelFor(key: string) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.replace(/^customer_/, "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric(value));
}

function uniqueValues(items: CustomerRecord[], key: string) {
  return Array.from(new Set(items.map((item) => field(item, key, "")).filter(Boolean))).sort();
}

function customerKey(customer: CustomerRecord) {
  return field(customer, "id", "");
}

function saleAmount(sale: SaleRecord) {
  return sale.sale_total_amount ?? sale.total_amount ?? sale.total_revenue ?? sale.revenue ?? sale.amount ?? sale.sale_subtotal_amount;
}

function commercialStatus(customer: CustomerRecord) {
  const days = numeric(customer.customer_days_since_last_purchase);
  if (days > 90) return { label: "Inactivo", variant: "secondary" as const };
  if (days > 45) return { label: "En riesgo", variant: "outline" as const };
  return { label: "Activo", variant: "default" as const };
}

function hasCoordinates(customer: CustomerRecord | null | undefined) {
  return Boolean(customer?.customer_business_latitude && customer?.customer_business_longitude);
}

function firstText(customer: CustomerRecord | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = customer?.[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "";
}

function customerSegmentLabel(customer: CustomerRecord | null | undefined) {
  const explicitSegment = firstText(customer, ["segment_name", "customer_segment_name", "customer_segment"]);
  if (explicitSegment) return explicitSegment;
  const rfmSegment = firstText(customer, ["customer_rfm_segment", "rfm_segment"]);
  return rfmSegment ? `RFM ${rfmSegment}` : "";
}

function customerClusterLabel(customer: CustomerRecord | null | undefined) {
  return firstText(customer, ["cluster", "customer_cluster", "customer_cluster_name"]);
}

function parseProductList(value: unknown): CustomerTopProduct[] {
  if (!value) return [];
  if (Array.isArray(value)) return normalizeTopProducts(value);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeTopProducts(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeTopProducts(products: unknown[]): CustomerTopProduct[] {
  return products.map((item) => {
    const product = item as Record<string, unknown>;
    return {
      product_sku: String(product.product_sku ?? product.sku ?? ""),
      product_commercial_name: String(product.product_commercial_name ?? product.product_name ?? product.product ?? "Producto"),
      product_brand_name: product.product_brand_name != null ? String(product.product_brand_name) : null,
      total_units: Number(product.total_units ?? product.quantity ?? 0),
      total_revenue: product.total_revenue === undefined ? null : Number(product.total_revenue),
      last_purchase_date: product.last_purchase_date != null ? String(product.last_purchase_date) : null,
    };
  });
}

function extractTopProducts(customer: CustomerRecord | null): CustomerTopProduct[] {
  const candidateKeys = [
    "customer_top_purchased_products_snapshot",
    "top_products",
    "customer_top_products",
    "top_products_purchased",
    "customer_products_top",
    "products_top",
  ];
  for (const key of candidateKeys) {
    const products = parseProductList(customer?.[key]);
    if (products.length > 0) return products.slice(0, 5);
  }
  return [];
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCustomers, setTotalCustomers] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [businessType, setBusinessType] = useState("all");
  const [governmentId, setGovernmentId] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [salesRepId, setSalesRepId] = useState("");
  const [hasLocation, setHasLocation] = useState("all");
  const [minRevenue, setMinRevenue] = useState("");
  const [maxRevenue, setMaxRevenue] = useState("");
  const [minPurchases, setMinPurchases] = useState("");
  const [maxPurchases, setMaxPurchases] = useState("");
  const [minTicket, setMinTicket] = useState("");
  const [maxTicket, setMaxTicket] = useState("");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");

  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [sales] = useState<SaleRecord[]>([]);
  const [tracing] = useState<TracingRecord[]>([]);

  const buildParams = useCallback((offset: number): CustomerParams => ({
    search: search.trim() || undefined,
    business_type: businessType === "all" ? undefined : businessType,
    government_id: governmentId.trim() || undefined,
    city: city.trim() || undefined,
    state: stateName.trim() || undefined,
    sales_representative_id: optionalNumber(salesRepId),
    has_location: hasLocation === "all" ? undefined : hasLocation === "yes",
    min_revenue: optionalNumber(minRevenue),
    max_revenue: optionalNumber(maxRevenue),
    min_purchases: optionalNumber(minPurchases),
    max_purchases: optionalNumber(maxPurchases),
    min_average_ticket: optionalNumber(minTicket),
    max_average_ticket: optionalNumber(maxTicket),
    min_days_since_last_purchase: optionalNumber(minDays),
    max_days_since_last_purchase: optionalNumber(maxDays),
    limit: PAGE_SIZE,
    offset,
  }), [
    businessType,
    city,
    governmentId,
    hasLocation,
    maxDays,
    maxPurchases,
    maxRevenue,
    maxTicket,
    minDays,
    minPurchases,
    minRevenue,
    minTicket,
    salesRepId,
    search,
    stateName,
  ]);

  const fetchPage = useCallback(async (offset: number, mode: "reset" | "append") => {
    if (mode === "reset") {
      setLoadingInitial(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const page = await getCustomersPage(buildParams(offset));
      const batch = page.data ?? [];
      const total = listTotal(page) ?? offset + batch.length;
      setTotalCustomers(total);
      setCustomers((prev) => {
        const base = mode === "reset" ? [] : prev;
        const seen = new Set(base.map(customerKey));
        const next = [...base];
        batch.forEach((item) => {
          if (!seen.has(customerKey(item))) {
            seen.add(customerKey(item));
            next.push(item);
          }
        });
        return next;
      });
      setHasMore(offset + batch.length < total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      if (mode === "reset") setCustomers([]);
      if (mode === "reset") setTotalCustomers(null);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  }, [buildParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchPage(0, "reset"), 250);
    return () => window.clearTimeout(timer);
  }, [fetchPage]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loadingInitial && !loadingMore) {
        fetchPage(customers.length, "append");
      }
    }, { rootMargin: "500px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [customers.length, fetchPage, hasMore, loadingInitial, loadingMore]);

  const businessTypes = useMemo(() => uniqueValues(customers, "customer_business_type"), [customers]);
  const representatives = useMemo(() => {
    const seen = new Map<string, string>();
    customers.forEach((customer) => {
      const id = field(customer, "sales_representative_id", "");
      const name = field(customer, "sales_rep_full_name", "");
      if (id && name) seen.set(id, name);
    });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [customers]);

  const totalRevenue = customers.reduce((sum, item) => sum + numeric(item.customer_total_lifetime_revenue), 0);
  const totalPurchases = customers.reduce((sum, item) => sum + numeric(item.customer_total_number_of_purchases), 0);
  const averageTicket = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
  const totalLabel = totalCustomers === null ? null : totalCustomers.toLocaleString("es-CO");
  const loadedLabel = customers.length.toLocaleString("es-CO");
  const lifecycleValue =
    minDays === "" && maxDays === "45" ? "active"
      : minDays === "46" && maxDays === "90" ? "risk"
        : minDays === "91" && maxDays === "" ? "inactive"
          : "custom";
  const advancedFilterCount = [
    governmentId.trim(),
    city.trim(),
    stateName.trim(),
    hasLocation !== "all",
    minRevenue,
    maxRevenue,
    minPurchases,
    maxPurchases,
    minTicket,
    maxTicket,
    minDays,
    maxDays,
  ].filter(Boolean).length;
  const activeFilters = [
    search.trim() && { key: "search", label: `Busqueda: ${search.trim()}`, clear: () => setSearch("") },
    businessType !== "all" && { key: "businessType", label: `Tipo: ${businessType}`, clear: () => setBusinessType("all") },
    salesRepId.trim() && { key: "salesRepId", label: `Rep: ${representatives.find(([id]) => id === salesRepId)?.[1] ?? salesRepId}`, clear: () => setSalesRepId("") },
    governmentId.trim() && { key: "governmentId", label: `NIT: ${governmentId.trim()}`, clear: () => setGovernmentId("") },
    city.trim() && { key: "city", label: `Ciudad: ${city.trim()}`, clear: () => setCity("") },
    stateName.trim() && { key: "stateName", label: `Departamento: ${stateName.trim()}`, clear: () => setStateName("") },
    hasLocation !== "all" && { key: "hasLocation", label: hasLocation === "yes" ? "Con ubicacion" : "Sin ubicacion", clear: () => setHasLocation("all") },
    lifecycleValue === "active" && { key: "lifecycle", label: "Estado: Activo", clear: () => setLifecycleFilter("custom") },
    lifecycleValue === "risk" && { key: "lifecycle", label: "Estado: En riesgo", clear: () => setLifecycleFilter("custom") },
    lifecycleValue === "inactive" && { key: "lifecycle", label: "Estado: Inactivo", clear: () => setLifecycleFilter("custom") },
    minRevenue && { key: "minRevenue", label: `Ingresos >= ${money(minRevenue)}`, clear: () => setMinRevenue("") },
    maxRevenue && { key: "maxRevenue", label: `Ingresos <= ${money(maxRevenue)}`, clear: () => setMaxRevenue("") },
    minPurchases && { key: "minPurchases", label: `Compras >= ${minPurchases}`, clear: () => setMinPurchases("") },
    maxPurchases && { key: "maxPurchases", label: `Compras <= ${maxPurchases}`, clear: () => setMaxPurchases("") },
    minTicket && { key: "minTicket", label: `Ticket >= ${money(minTicket)}`, clear: () => setMinTicket("") },
    maxTicket && { key: "maxTicket", label: `Ticket <= ${money(maxTicket)}`, clear: () => setMaxTicket("") },
    lifecycleValue === "custom" && minDays && { key: "minDays", label: `Dias >= ${minDays}`, clear: () => setMinDays("") },
    lifecycleValue === "custom" && maxDays && { key: "maxDays", label: `Dias <= ${maxDays}`, clear: () => setMaxDays("") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const setLifecycleFilter = (value: string) => {
    if (value === "active") {
      setMinDays("");
      setMaxDays("45");
    } else if (value === "risk") {
      setMinDays("46");
      setMaxDays("90");
    } else if (value === "inactive") {
      setMinDays("91");
      setMaxDays("");
    } else {
      setMinDays("");
      setMaxDays("");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setBusinessType("all");
    setGovernmentId("");
    setCity("");
    setStateName("");
    setSalesRepId("");
    setHasLocation("all");
    setMinRevenue("");
    setMaxRevenue("");
    setMinPurchases("");
    setMaxPurchases("");
    setMinTicket("");
    setMaxTicket("");
    setMinDays("");
    setMaxDays("");
  };

  const openProfile = (customer: CustomerRecord) => {
    setSelected(customer);
  };

  const currentProfile = selected;
  const additionalFields = Object.entries(currentProfile ?? {}).filter(([key, value]) => !CORE_CUSTOMER_FIELDS.has(key) && value !== null && value !== undefined && value !== "");
  const profileStatus = currentProfile ? commercialStatus(currentProfile) : null;
  const profileSegment = customerSegmentLabel(currentProfile);
  const profileCluster = customerClusterLabel(currentProfile);
  const topProducts = useMemo(() => extractTopProducts(currentProfile), [currentProfile]);

  const copyText = async (value: string, label: string) => {
    if (!value || value === "N/A") return;
    await navigator.clipboard?.writeText(value);
    toast.success(`${label} copiado`);
  };

  const openMap = (customer: CustomerRecord | null | undefined) => {
    if (!customer || !hasCoordinates(customer)) return;
    const lat = field(customer, "customer_business_latitude");
    const lng = field(customer, "customer_business_longitude");
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Clientes</h1>
          <p className="text-muted-foreground">Analiza, segmenta y prioriza clientes comerciales</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchPage(0, "reset")} disabled={loadingInitial} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Clientes cargados", value: totalLabel ? `${loadedLabel} / ${totalLabel}` : loadedLabel, note: "Segun filtros actuales", icon: UserRound },
          { title: "Ingresos acumulados", value: money(totalRevenue), note: "Base cargada", icon: BarChart3 },
          { title: "Compras totales", value: totalPurchases.toLocaleString("es-CO"), note: "Historial visible", icon: ReceiptText },
          { title: "Ticket promedio", value: money(averageTicket), note: "Ingresos / compras", icon: TrendingUp },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
              <item.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loadingInitial ? <div className="h-7 w-24 animate-pulse rounded bg-muted" /> : <p className="text-2xl font-bold">{item.value}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_220px_260px_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} disabled={loadingInitial} placeholder="Buscar por nombre, NIT, email o celular" className="h-10 pl-9" />
            </div>
            <Select value={businessType} onValueChange={setBusinessType} disabled={loadingInitial}>
              <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{businessTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={salesRepId || "all"} onValueChange={(value) => setSalesRepId(value === "all" ? "" : value)} disabled={loadingInitial}>
              <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Representante" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos los representantes</SelectItem>{representatives.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={advancedFilterCount > 0 ? "default" : "outline"} className="h-10 w-full gap-2 xl:w-auto" disabled={loadingInitial}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                  {advancedFilterCount > 0 && <span className="rounded bg-background/20 px-1.5 text-xs">{advancedFilterCount}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[min(78svh,680px)] w-[calc(100vw-1.5rem)] overflow-y-auto p-0 sm:w-[min(94vw,860px)]">
                <div className="border-b p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">Filtros avanzados</p>
                      <p className="text-sm text-muted-foreground">Estos campos se consultan directamente en clientes y respetan el alcance del usuario.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearFilters} disabled={loadingInitial} className="w-full gap-2 sm:w-auto">
                      <X className="h-4 w-4" /> Limpiar todo
                    </Button>
                  </div>
                </div>

                <div className="space-y-5 p-4">
                  <FilterSection icon={UserRound} title="Identificacion y territorio">
                    <FilterField label="Documento / NIT">
                      <Input value={governmentId} onChange={(event) => setGovernmentId(event.target.value)} disabled={loadingInitial} placeholder="Ej: CN901..." />
                    </FilterField>
                    <FilterField label="Ciudad">
                      <Input value={city} onChange={(event) => setCity(event.target.value)} disabled={loadingInitial} placeholder="Medellin, Cali..." />
                    </FilterField>
                    <FilterField label="Departamento">
                      <Input value={stateName} onChange={(event) => setStateName(event.target.value)} disabled={loadingInitial} placeholder="Antioquia..." />
                    </FilterField>
                    <FilterField label="Georreferenciacion">
                      <Select value={hasLocation} onValueChange={setHasLocation} disabled={loadingInitial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="yes">Con ubicacion</SelectItem>
                          <SelectItem value="no">Sin ubicacion</SelectItem>
                        </SelectContent>
                      </Select>
                    </FilterField>
                  </FilterSection>

                  <Separator />

                  <FilterSection icon={BarChart3} title="Rendimiento comercial">
                    <RangeFilter label="Ingresos acumulados" min={minRevenue} max={maxRevenue} onMinChange={setMinRevenue} onMaxChange={setMaxRevenue} minPlaceholder="Min. COP" maxPlaceholder="Max. COP" />
                    <RangeFilter label="Compras realizadas" min={minPurchases} max={maxPurchases} onMinChange={setMinPurchases} onMaxChange={setMaxPurchases} minPlaceholder="Min." maxPlaceholder="Max." />
                    <RangeFilter label="Ticket promedio" min={minTicket} max={maxTicket} onMinChange={setMinTicket} onMaxChange={setMaxTicket} minPlaceholder="Min. COP" maxPlaceholder="Max. COP" />
                  </FilterSection>

                  <Separator />

                  <FilterSection icon={RefreshCw} title="Recencia">
                    <FilterField label="Estado comercial">
                      <Select value={lifecycleValue} onValueChange={setLifecycleFilter} disabled={loadingInitial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Personalizado</SelectItem>
                          <SelectItem value="active">Activo: hasta 45 dias</SelectItem>
                          <SelectItem value="risk">En riesgo: 46 a 90 dias</SelectItem>
                          <SelectItem value="inactive">Inactivo: 91+ dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </FilterField>
                    <RangeFilter label="Dias sin compra" min={minDays} max={maxDays} onMinChange={setMinDays} onMaxChange={setMaxDays} minPlaceholder="Min. dias" maxPlaceholder="Max. dias" />
                  </FilterSection>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={lifecycleValue === "active" ? "default" : "outline"} onClick={() => setLifecycleFilter(lifecycleValue === "active" ? "custom" : "active")} disabled={loadingInitial} className="h-8">Activos</Button>
            <Button type="button" size="sm" variant={lifecycleValue === "risk" ? "default" : "outline"} onClick={() => setLifecycleFilter(lifecycleValue === "risk" ? "custom" : "risk")} disabled={loadingInitial} className="h-8">En riesgo</Button>
            <Button type="button" size="sm" variant={lifecycleValue === "inactive" ? "default" : "outline"} onClick={() => setLifecycleFilter(lifecycleValue === "inactive" ? "custom" : "inactive")} disabled={loadingInitial} className="h-8">Inactivos</Button>
            <Button type="button" size="sm" variant={hasLocation === "yes" ? "default" : "outline"} onClick={() => setHasLocation(hasLocation === "yes" ? "all" : "yes")} disabled={loadingInitial} className="h-8 gap-2"><MapPinned className="h-3.5 w-3.5" /> Con ubicacion</Button>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
                  {filter.label}
                  <button type="button" onClick={filter.clear} disabled={loadingInitial} className="ml-1 rounded-sm p-0.5 hover:bg-background/70 disabled:pointer-events-none disabled:opacity-50" aria-label={`Quitar ${filter.label}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearFilters} disabled={loadingInitial} className="h-6 px-2 text-xs">
                <X className="mr-1 h-3 w-3" /> Limpiar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
          {loadingInitial ? (
            <div className="space-y-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-muted" />)}</div>
          ) : customers.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
              <UserRound className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">{activeFilters.length > 0 ? "No encontramos clientes con estos filtros" : "Aun no hay clientes disponibles para tu alcance"}</p>
              <p className="max-w-md text-sm text-muted-foreground">Ajusta la busqueda o limpia los filtros para ampliar los resultados.</p>
              {activeFilters.length > 0 && <Button variant="outline" onClick={clearFilters} disabled={loadingInitial}>Limpiar filtros</Button>}
            </div>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {customers.map((customer) => {
                const status = commercialStatus(customer);
                return (
                  <div key={field(customer, "id")} className="rounded-md border bg-card p-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{field(customer, "customer_full_name", "Cliente sin nombre")}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{field(customer, "customer_email", field(customer, "customer_cellphone"))}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <Badge variant="outline">{field(customer, "customer_government_id")}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div><p className="text-xs text-muted-foreground">Compras</p><p className="font-semibold">{numeric(customer.customer_total_number_of_purchases).toLocaleString("es-CO")}</p></div>
                      <div><p className="text-xs text-muted-foreground">Ultima compra</p><p className="font-semibold">{numeric(customer.customer_days_since_last_purchase)} d</p></div>
                      <div><p className="text-xs text-muted-foreground">Ticket prom.</p><p className="font-semibold">{money(customer.customer_average_purchase_ticket_amount)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Ingresos</p><p className="font-semibold">{money(customer.customer_total_lifetime_revenue)}</p></div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1">
                      <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => openProfile(customer)} disabled={loadingInitial} title="Ver perfil"><Eye className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-9 w-full" onClick={() => copyText(field(customer, "customer_government_id", ""), "NIT")} disabled={loadingInitial} title="Copiar NIT"><Copy className="h-4 w-4" /></Button>
                      {field(customer, "customer_email", "") ? <Button variant="outline" size="icon" className="h-9 w-full" asChild title="Escribir email"><a href={`mailto:${field(customer, "customer_email", "")}`}><Mail className="h-4 w-4" /></a></Button> : <div />}
                      {field(customer, "customer_cellphone", "") ? <Button variant="outline" size="icon" className="h-9 w-full" asChild title="Llamar"><a href={`tel:${field(customer, "customer_cellphone_country_dial_code", "")}${field(customer, "customer_cellphone", "")}`}><Phone className="h-4 w-4" /></a></Button> : <div />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead>Compras</TableHead>
                  <TableHead>Ticket prom.</TableHead>
                  <TableHead>Últ. compra</TableHead>
                  <TableHead>Ingresos</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => {
                  const status = commercialStatus(customer);
                  return (
                    <TableRow key={field(customer, "id")} className="group">
                      <TableCell className="max-w-[280px]">
                        <div className="flex flex-col gap-1">
                          <p className="truncate font-medium">{field(customer, "customer_full_name", "Cliente sin nombre")}</p>
                          <p className="truncate text-xs text-muted-foreground">{field(customer, "customer_email", field(customer, "customer_cellphone"))}</p>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{field(customer, "customer_government_id")}</TableCell>
                      <TableCell>{field(customer, "sales_rep_full_name")}</TableCell>
                      <TableCell className="text-center">{numeric(customer.customer_total_number_of_purchases).toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-center">{money(customer.customer_average_purchase_ticket_amount)}</TableCell>
                      <TableCell className="text-center">{numeric(customer.customer_days_since_last_purchase)} d</TableCell>
                      <TableCell className="text-center">{money(customer.customer_total_lifetime_revenue)}</TableCell>
                      <TableCell>
                        <div className="flex justify-start gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openProfile(customer)} disabled={loadingInitial} title="Ver perfil"><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(field(customer, "customer_government_id", ""), "NIT")} disabled={loadingInitial} title="Copiar NIT"><Copy className="h-4 w-4" /></Button>
                          {field(customer, "customer_email", "") && <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Escribir email"><a href={`mailto:${field(customer, "customer_email", "")}`}><Mail className="h-4 w-4" /></a></Button>}
                          {field(customer, "customer_cellphone", "") && <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Llamar"><a href={`tel:${field(customer, "customer_cellphone_country_dial_code", "")}${field(customer, "customer_cellphone", "")}`}><Phone className="h-4 w-4" /></a></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            </>
          )}

          <div ref={sentinelRef} className="h-px" aria-hidden="true" />

          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-medium text-foreground">Cargando siguiente lote...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto p-4 sm:max-w-2xl sm:p-5">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <SheetTitle className="truncate text-base">{field(currentProfile, "customer_full_name", "Cliente sin nombre")}</SheetTitle>
                    <SheetDescription>
                      {field(currentProfile, "customer_government_id")}
                    </SheetDescription>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {profileStatus && <Badge variant={profileStatus.variant}>{profileStatus.label}</Badge>}
                      {profileSegment && <Badge variant="secondary">{profileSegment}</Badge>}
                      {profileCluster && <Badge variant="outline">{profileCluster}</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 pr-6">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copyText(field(currentProfile, "customer_government_id", ""), "NIT")} title="Copiar NIT"><Copy className="h-4 w-4" /></Button>
                    {field(currentProfile, "customer_email", "") && <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Email"><a href={`mailto:${field(currentProfile, "customer_email", "")}`}><Mail className="h-4 w-4" /></a></Button>}
                    {field(currentProfile, "customer_cellphone", "") && <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Llamar"><a href={`tel:${field(currentProfile, "customer_cellphone_country_dial_code", "")}${field(currentProfile, "customer_cellphone", "")}`}><Phone className="h-4 w-4" /></a></Button>}
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <ProfileMetric label="Ingresos" value={money(currentProfile?.customer_total_lifetime_revenue)} />
                  <ProfileMetric label="Compras" value={numeric(currentProfile?.customer_total_number_of_purchases).toLocaleString("es-CO")} />
                  <ProfileMetric label="Ticket prom." value={money(currentProfile?.customer_average_purchase_ticket_amount)} />
                  <ProfileMetric label="Ultima compra" value={`${numeric(currentProfile?.customer_days_since_last_purchase)} d`} />
                </div>

                <Tabs defaultValue="summary">
                  <TabsList className="w-full">
                    <TabsTrigger value="summary" className="min-w-max snap-start">Resumen</TabsTrigger>
                    <TabsTrigger value="performance" className="min-w-max snap-start">Rendimiento</TabsTrigger>
                    <TabsTrigger value="products" className="min-w-max snap-start">Productos top</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoPanel icon={Building2} title="Identidad comercial" rows={[
                        ["Tipo de negocio", field(currentProfile, "customer_business_type")],
                        ["Documento / NIT", field(currentProfile, "customer_government_id")],
                        ["Representante", field(currentProfile, "sales_rep_full_name", "Sin asignar")],
                      ]} />
                      <InfoPanel icon={MapPin} title="Ubicacion" rows={[
                        ["Ciudad", field(currentProfile, "customer_business_city")],
                        ["Departamento", field(currentProfile, "customer_business_state")],
                        ["Direccion", field(currentProfile, "customer_business_address")],
                      ]} />
                      <InfoPanel icon={WalletCards} title="Contacto" rows={[
                        ["Email", field(currentProfile, "customer_email")],
                        ["Celular", `${field(currentProfile, "customer_cellphone_country_dial_code", "")} ${field(currentProfile, "customer_cellphone")}`],
                      ]} />
                    </div>
                  </TabsContent>

                  <TabsContent value="performance" className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InsightCard title="Estado comercial" value={profileStatus?.label || "N/A"} note="Basado en dias desde la ultima compra" icon={Activity} />
                      <InsightCard title="Oportunidad" value={numeric(currentProfile?.customer_days_since_last_purchase) > 60 ? "Reactivar" : "Mantener"} note="Prioriza seguimiento segun recencia" icon={TrendingUp} />
                      <InsightCard title="Segmento" value={profileSegment || "Sin segmento"} note={profileCluster || "Desde la informacion del cliente"} icon={UserRound} />
                      <InsightCard title="Productos comprados" value={topProducts.length ? `${topProducts.length} destacados` : "Sin ranking"} note="Calculado desde el historial comercial" icon={ReceiptText} />
                    </div>
                  </TabsContent>

                  <TabsContent value="products" className="mt-3 space-y-2">
                    {topProducts.length > 0 ? (
                      <div className="overflow-hidden rounded-md border">
                        <div className="grid grid-cols-[2.5rem_1fr_5rem] bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                          <span>#</span>
                          <span>Producto</span>
                          <span className="text-right">Cantidad</span>
                        </div>
                        {topProducts.map((product, index) => (
                          <div key={`${product.product_commercial_name}-${index}`} className="grid grid-cols-[2.5rem_1fr_5rem] items-center border-t px-3 py-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                            <p className="min-w-0 truncate text-sm font-medium">{product.product_commercial_name || "Producto"}</p>
                            <p className="text-right text-sm font-semibold">{numeric(product.total_units).toLocaleString("es-CO")}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border bg-muted/40 p-4">
                        <p className="font-medium">Aun no hay productos top disponibles.</p>
                        <p className="mt-1 text-sm text-muted-foreground">Este cliente no trae productos en el snapshot.</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="sales" className="mt-4 space-y-2">
                    {sales.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">Sin ventas recientes disponibles</p>
                    ) : sales.map((sale, index) => (
                      <div key={`${field(sale, "id", String(index))}`} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{field(sale, "sale_invoice_number", field(sale, "id", "Venta"))}</p>
                          <p className="text-xs text-muted-foreground">{field(sale, "created_at")} Â· {field(sale, "sale_origin_channel")}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-semibold">{money(saleAmount(sale))}</p>
                          <Badge variant="outline">{field(sale, "sale_status_code")}</Badge>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="tracing" className="mt-4 space-y-2">
                    {tracing.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">Sin seguimiento registrado</p>
                    ) : tracing.map((item, index) => (
                      <div key={`${field(item, "id", String(index))}`} className="rounded-md border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-medium">{field(item, "tracing_interaction_type", "Interaccion")}</p>
                          <Badge variant="outline">{field(item, "tracing_current_status")}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{field(item, "tracing_next_step")}</p>
                        <p className="mt-2 text-sm">{field(item, "tracing_notes", "")}</p>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RangeFilter({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
  minPlaceholder,
  maxPlaceholder,
}: {
  label: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder: string;
  maxPlaceholder: string;
}) {
  return (
    <div className="space-y-1.5 lg:col-span-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" min="0" value={min} onChange={(event) => onMinChange(event.target.value)} placeholder={minPlaceholder} />
        <Input type="number" min="0" value={max} onChange={(event) => onMaxChange(event.target.value)} placeholder={maxPlaceholder} />
      </div>
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  rows,
}: {
  icon: React.ElementType;
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><p className="font-semibold">{title}</p></div>
      <div className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <p key={label} className="break-words"><span className="text-muted-foreground">{label}:</span> {value}</p>
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  note,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
