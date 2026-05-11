import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  getOrder,
  getOrderFilterOptions,
  getOrdersPage,
  listTotal,
  Order,
  OrderLineItem,
  OrderListParams,
} from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { ErrorDisabledContent } from "@/components/common/ErrorDisabledContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUpAZ,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Eye,
  Loader2,
  Package,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { formatApiErrorMessage } from "@/lib/errors";

const PAGE_SIZE = 200;

const CORE_ORDER_FIELDS = new Set([
  "id",
  "source_sale_id",
  "distributor_id",
  "customer_id",
  "sales_representative_id",
  "sales_representative_name",
  "sales_representative_email",
  "sales_representative_phone",
  "order_taking_person_name",
  "order_taking_person_name_normalized",
  "order_number",
  "buyer_internal_code_at_sale",
  "buyer_full_name_at_sale",
  "buyer_cellphone_at_sale",
  "buyer_email_at_sale",
  "order_status_code",
  "order_delivery_address",
  "order_payment_method",
  "order_additional_observations",
  "order_origin_channel",
  "order_origin_platform",
  "order_source_xlsx_filename",
  "customer_pets_info_at_sale_snapshot",
  "order_additional_metadata",
  "order_source_reference",
  "sap_doc_date",
  "sell_at",
  "doc_total",
  "store_id",
  "created_at",
  "updated_at",
  "source_order_id",
  "sale_invoice_number",
  "sale_status_code",
  "sale_delivery_address",
  "sale_payment_method",
  "sale_additional_observations",
  "sale_origin_channel",
  "sale_origin_platform",
  "sale_source_xlsx_filename",
  "sale_additional_metadata",
  "line_items_count",
  "line_items_total_quantity",
  "line_items_total_amount",
  "line_items",
]);

function text(value: unknown, fallback = "N/A") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numberValue(value: unknown) {
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
  }).format(numberValue(value));
}

function formatCount(value: unknown) {
  return numberValue(value).toLocaleString("es-CO");
}

function formatDate(value: unknown) {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

function orderDate(order: Order | null | undefined) {
  return order?.sell_at ?? order?.sap_doc_date ?? order?.created_at;
}

function orderKey(order: Order) {
  return String(order.id);
}

function orderStatus(order: Order | null | undefined) {
  const rawStatus = order?.order_status_code ?? order?.sale_status_code;
  return orderStatusInfo(rawStatus);
}

function orderStatusKey(value: unknown) {
  const raw = text(value, "").trim().toLowerCase();
  if (["0", "open", "abierto", "bost_open"].includes(raw)) return "open";
  if (["1", "close", "closed", "cerrado", "bost_close"].includes(raw)) return "closed";
  return raw;
}

function orderStatusInfo(value: unknown) {
  const key = orderStatusKey(value);
  if (key === "closed") return { label: "Cerrado", variant: "default" as const };
  if (key === "open") return { label: "Abierto", variant: "outline" as const };
  const status = text(value, "Sin estado");
  return { label: status, variant: "outline" as const };
}

function orderSortParams(value: string): Pick<OrderListParams, "sort_by" | "sort_dir"> {
  if (value === "date_asc") return { sort_by: "date", sort_dir: "asc" };
  if (value === "total_desc") return { sort_by: "total", sort_dir: "desc" };
  if (value === "total_asc") return { sort_by: "total", sort_dir: "asc" };
  if (value === "customer_asc") return { sort_by: "customer", sort_dir: "asc" };
  if (value === "lines_desc") return { sort_by: "lines", sort_dir: "desc" };
  return { sort_by: "date", sort_dir: "desc" };
}

function normalizeLineItems(order: Order | null): OrderLineItem[] {
  const value = order?.line_items;
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function labelFor(key: string) {
  const labels: Record<string, string> = {
    id: "ID",
    source_sale_id: "Venta origen",
    source_order_id: "Orden origen",
    order_source_reference: "Referencia origen",
    order_source_xlsx_filename: "Archivo origen",
    sale_invoice_number: "Factura",
    store_id: "Tienda",
    created_at: "Creado",
    updated_at: "Actualizado",
  };
  return labels[key] ?? key.replace(/^order_/, "").replace(/^sale_/, "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatField(value: unknown) {
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("es-CO") : value.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return "Objeto no disponible";
    }
  }
  return text(value);
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState({
    statuses: [] as string[],
    originChannels: [] as string[],
    paymentMethods: [] as string[],
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [customerId, setCustomerId] = useState("");
  const [salesRepId, setSalesRepId] = useState("");
  const [originChannel, setOriginChannel] = useState("all");
  const [originPlatform, setOriginPlatform] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [hasObservations, setHasObservations] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [sortOrder, setSortOrder] = useState("date_desc");

  const [selectedSummary, setSelectedSummary] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const buildParams = useCallback((offset: number): OrderListParams => ({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
    customer_id: optionalNumber(customerId),
    sales_representative_id: optionalNumber(salesRepId),
    origin_channel: originChannel === "all" ? undefined : originChannel,
    origin_platform: originPlatform.trim() || undefined,
    payment_method: paymentMethod === "all" ? undefined : paymentMethod,
    invoice_number: invoiceNumber.trim() || undefined,
    has_observations: hasObservations === "all" ? undefined : hasObservations === "yes",
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    min_total: optionalNumber(minTotal),
    max_total: optionalNumber(maxTotal),
    ...orderSortParams(sortOrder),
    limit: PAGE_SIZE,
    offset,
  }), [customerId, dateFrom, dateTo, hasObservations, invoiceNumber, maxTotal, minTotal, originChannel, originPlatform, paymentMethod, salesRepId, search, sortOrder, status]);

  const fetchPage = useCallback(async (offset: number, mode: "reset" | "append") => {
    if (mode === "reset") {
      setLoadingInitial(true);
      setError(null);
      setOrders([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await getOrdersPage(buildParams(offset));
      const batch = response.data ?? [];
      const total = listTotal(response);
      setTotalOrders(total);
      setOrders((prev) => {
        const base = mode === "reset" ? [] : prev;
        const seen = new Set(base.map(orderKey));
        const next = [...base];
        batch.forEach((item) => {
          if (!seen.has(orderKey(item))) {
            seen.add(orderKey(item));
            next.push(item);
          }
        });
        return next;
      });
      setHasMore(total === null ? batch.length === PAGE_SIZE : offset + batch.length < total);
    } catch (err) {
      setError(formatApiErrorMessage(err));
      if (mode === "reset") {
        setOrders([]);
        setTotalOrders(null);
      }
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
    let cancelled = false;
    getOrderFilterOptions()
      .then((options) => {
        if (!cancelled) {
          setFilterOptions({
            statuses: Array.isArray(options.statuses) ? options.statuses : [],
            originChannels: Array.isArray(options.origin_channels) ? options.origin_channels : [],
            paymentMethods: Array.isArray(options.payment_methods) ? options.payment_methods : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFilterOptions({ statuses: [], originChannels: [], paymentMethods: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingInitial && !loadingMore) {
        void fetchPage(orders.length, "append");
      }
    }, { rootMargin: "260px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loadingInitial, loadingMore, orders.length]);

  useEffect(() => {
    if (!selectedSummary) {
      setSelectedOrder(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedOrder(selectedSummary);
    setDetailError(null);
    setDetailLoading(true);
    getOrder(selectedSummary.id)
      .then((order) => {
        if (!cancelled) setSelectedOrder(order);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(formatApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSummary]);

  const loadedLabel = orders.length.toLocaleString("es-CO");
  const totalLabel = totalOrders === null ? "..." : totalOrders.toLocaleString("es-CO");
  const totalValue = orders.reduce((sum, item) => sum + numberValue(item.doc_total), 0);
  const totalItems = orders.reduce((sum, item) => sum + numberValue(item.line_items_count), 0);
  const averageTicket = orders.length > 0 ? totalValue / orders.length : 0;
  const visibleStatuses = useMemo(() => new Set(orders.map((item) => orderStatusKey(item.order_status_code)).filter(Boolean)).size, [orders]);
  const statusFilterOptions = useMemo(() => {
    const keys = new Set(filterOptions.statuses.map(orderStatusKey).filter((item) => item === "open" || item === "closed"));
    const options = [
      { key: "open", label: "Abierto" },
      { key: "closed", label: "Cerrado" },
    ];
    return keys.size > 0 ? options.filter((item) => keys.has(item.key)) : options;
  }, [filterOptions.statuses]);

  const activeFilters = [
    search.trim() && { key: "search", label: `Busqueda: ${search.trim()}`, clear: () => setSearch("") },
    status !== "all" && { key: "status", label: `Estado: ${orderStatusInfo(status).label}`, clear: () => setStatus("all") },
    customerId.trim() && { key: "customerId", label: `Cliente: ${customerId.trim()}`, clear: () => setCustomerId("") },
    salesRepId.trim() && { key: "salesRepId", label: `Rep: ${salesRepId.trim()}`, clear: () => setSalesRepId("") },
    originChannel !== "all" && { key: "originChannel", label: `Canal: ${originChannel}`, clear: () => setOriginChannel("all") },
    originPlatform.trim() && { key: "originPlatform", label: `Plataforma: ${originPlatform.trim()}`, clear: () => setOriginPlatform("") },
    paymentMethod !== "all" && { key: "paymentMethod", label: `Pago: ${paymentMethod}`, clear: () => setPaymentMethod("all") },
    invoiceNumber.trim() && { key: "invoiceNumber", label: `Factura: ${invoiceNumber.trim()}`, clear: () => setInvoiceNumber("") },
    hasObservations === "yes" && { key: "hasObservations", label: "Con observaciones", clear: () => setHasObservations("all") },
    hasObservations === "no" && { key: "hasObservations", label: "Sin observaciones", clear: () => setHasObservations("all") },
    dateFrom && { key: "dateFrom", label: `Desde: ${dateFrom}`, clear: () => setDateFrom("") },
    dateTo && { key: "dateTo", label: `Hasta: ${dateTo}`, clear: () => setDateTo("") },
    minTotal && { key: "minTotal", label: `Total >= ${money(minTotal)}`, clear: () => setMinTotal("") },
    maxTotal && { key: "maxTotal", label: `Total <= ${money(maxTotal)}`, clear: () => setMaxTotal("") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;
  const advancedFilterCount = [
    customerId,
    salesRepId,
    originChannel !== "all",
    originPlatform,
    paymentMethod !== "all",
    invoiceNumber,
    hasObservations !== "all",
    dateFrom,
    dateTo,
    minTotal,
    maxTotal,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setCustomerId("");
    setSalesRepId("");
    setOriginChannel("all");
    setOriginPlatform("");
    setPaymentMethod("all");
    setInvoiceNumber("");
    setHasObservations("all");
    setDateFrom("");
    setDateTo("");
    setMinTotal("");
    setMaxTotal("");
  };

  const currentOrder = selectedOrder ?? selectedSummary;
  const currentStatus = orderStatus(currentOrder);
  const lineItems = normalizeLineItems(currentOrder);
  const additionalFields = Object.entries(currentOrder ?? {}).filter(([key, value]) => !CORE_ORDER_FIELDS.has(key) && value !== null && value !== undefined && value !== "");

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={!!error}>
        <PageHeader
          icon={ReceiptText}
          title="Ordenes"
          description="Consulta ordenes comerciales, estado, cliente, valor y productos vendidos."
        />
      </ErrorDisabledContent>

      {error && (
        <ModuleErrorCard message={error} onRetry={() => fetchPage(0, "reset")} loading={loadingInitial} />
      )}

      <ErrorDisabledContent disabled={!!error} className="space-y-5 sm:space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Ordenes cargadas" value={`${loadedLabel} / ${totalLabel}`} note="Segun filtros actuales" icon={ReceiptText} loading={loadingInitial} />
          <KpiCard title="Valor visible" value={money(totalValue)} note={`Ticket promedio ${money(averageTicket)}`} icon={CreditCard} loading={loadingInitial} />
          <KpiCard title="Items visibles" value={formatCount(totalItems)} note="Productos y servicios en ordenes" icon={Package} loading={loadingInitial} />
          <KpiCard title="Estados visibles" value={formatCount(visibleStatuses)} note="Segun resultados cargados" icon={ClipboardList} loading={loadingInitial} />
        </div>

        <Card>
          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(22rem,1fr)_14rem_15rem_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por orden, cliente, factura o producto" className="pl-9" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statusFilterOptions.map((item) => (
                    <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="gap-2">
                  <ArrowUpAZ className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Ordenar por mas recientes</SelectItem>
                  <SelectItem value="date_asc">Ordenar por mas antiguas</SelectItem>
                  <SelectItem value="total_desc">Ordenar por mayor valor</SelectItem>
                  <SelectItem value="total_asc">Ordenar por menor valor</SelectItem>
                  <SelectItem value="customer_asc">Ordenar por cliente A-Z</SelectItem>
                  <SelectItem value="lines_desc">Ordenar por mas items</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={advancedFilterCount > 0 ? "default" : "outline"} className="justify-center gap-2 xl:min-w-24" disabled={loadingInitial}>
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros
                    {advancedFilterCount > 0 && <span className="rounded bg-background/20 px-1.5 text-xs">{advancedFilterCount}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="max-h-[min(78svh,680px)] w-[calc(100vw-1.5rem)] overflow-y-auto p-0 sm:w-[min(94vw,900px)]">
                  <div className="border-b p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">Filtros avanzados</p>
                        <p className="text-sm text-muted-foreground">Estos campos se consultan directamente en ordenes y respetan el alcance del usuario.</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearFilters} disabled={loadingInitial} className="w-full gap-2 sm:w-auto">
                        <X className="h-4 w-4" /> Limpiar todo
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-5 p-4">
                    <FilterSection icon={UserRound} title="Cliente y responsable">
                      <FilterField label="ID cliente">
                        <Input type="number" min="1" value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={loadingInitial} placeholder="Ej. 12045" />
                      </FilterField>
                      <FilterField label="ID representante">
                        <Input type="number" min="1" value={salesRepId} onChange={(event) => setSalesRepId(event.target.value)} disabled={loadingInitial} placeholder="Ej. 18" />
                      </FilterField>
                      <FilterField label="Factura">
                        <Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} disabled={loadingInitial} placeholder="Numero factura" />
                      </FilterField>
                      <FilterField label="Observaciones">
                        <Select value={hasObservations} onValueChange={setHasObservations} disabled={loadingInitial}>
                          <SelectTrigger><SelectValue placeholder="Observaciones" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="yes">Con observaciones</SelectItem>
                            <SelectItem value="no">Sin observaciones</SelectItem>
                          </SelectContent>
                        </Select>
                      </FilterField>
                    </FilterSection>

                    <Separator />

                    <FilterSection icon={Truck} title="Origen y entrega">
                      <FilterField label="Canal">
                        <Select value={originChannel} onValueChange={setOriginChannel} disabled={loadingInitial}>
                          <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los canales</SelectItem>
                            {filterOptions.originChannels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FilterField>
                      <FilterField label="Plataforma">
                        <Input value={originPlatform} onChange={(event) => setOriginPlatform(event.target.value)} disabled={loadingInitial} placeholder="SAP-B1, web..." />
                      </FilterField>
                      <FilterField label="Metodo de pago">
                        <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={loadingInitial}>
                          <SelectTrigger><SelectValue placeholder="Pago" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los metodos</SelectItem>
                            {filterOptions.paymentMethods.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FilterField>
                    </FilterSection>

                    <Separator />

                    <FilterSection icon={CalendarDays} title="Fechas">
                      <FilterField label="Desde">
                        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} disabled={loadingInitial} />
                      </FilterField>
                      <FilterField label="Hasta">
                        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} disabled={loadingInitial} />
                      </FilterField>
                    </FilterSection>

                    <Separator />

                    <FilterSection icon={CreditCard} title="Valor de la orden">
                      <RangeFilter label="Total orden" min={minTotal} max={maxTotal} onMinChange={setMinTotal} onMaxChange={setMaxTotal} minPlaceholder="Min. COP" maxPlaceholder="Max. COP" disabled={loadingInitial} />
                    </FilterSection>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {activeFilters.map((filter) => (
                  <Badge
                    key={filter.key}
                    variant="secondary"
                    className="gap-1.5 bg-primary/10 pr-1 font-semibold text-primary hover:bg-primary/15 dark:bg-primary/15 dark:text-primary"
                  >
                    <span>{filter.label}</span>
                    <button type="button" onClick={filter.clear} className="rounded-sm p-0.5 hover:bg-background/60" aria-label={`Quitar ${filter.label}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1.5 rounded-full bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/15"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar
                </Button>
              </div>
            )}

            {loadingInitial && orders.length === 0 ? (
              <div className="grid gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-6 text-center">
                <p className="font-medium">No hay ordenes para los filtros actuales.</p>
                {activeFilters.length > 0 && <Button className="mt-3" variant="outline" onClick={clearFilters}>Limpiar filtros</Button>}
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {orders.map((order) => {
                    const statusInfo = orderStatus(order);
                    return (
                      <div key={order.id} className="rounded-md border bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{text(order.buyer_full_name_at_sale, "Cliente sin nombre")}</p>
                            <p className="mt-1 truncate text-sm text-muted-foreground">Orden {order.order_number}</p>
                          </div>
                          <Badge variant={statusInfo.variant} className="shrink-0">{statusInfo.label}</Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <Metric label="Fecha" value={formatDate(orderDate(order))} />
                          <Metric label="Valor" value={money(order.doc_total)} />
                          <Metric label="Items" value={formatCount(order.line_items_count)} />
                          <Metric label="Canal" value={text(order.order_origin_channel)} />
                        </div>
                        <Button variant="outline" className="mt-3 w-full gap-2" onClick={() => setSelectedSummary(order)}>
                          <Eye className="h-4 w-4" /> Ver detalle
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <Table className="min-w-[1120px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Orden</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Representante</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        const statusInfo = orderStatus(order);
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <p className="font-medium">{order.order_number}</p>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <p className="truncate font-medium">{text(order.buyer_full_name_at_sale, "Cliente sin nombre")}</p>
                              <p className="truncate text-xs text-muted-foreground">{text(order.buyer_email_at_sale, order.buyer_cellphone_at_sale)}</p>
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate">{text(order.sales_representative_name)}</TableCell>
                            <TableCell>{formatDate(orderDate(order))}</TableCell>
                            <TableCell>{text(order.order_origin_channel)}</TableCell>
                            <TableCell className="text-center">{formatCount(order.line_items_count)}</TableCell>
                            <TableCell className="text-right font-semibold">{money(order.doc_total)}</TableCell>
                            <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedSummary(order)} title="Ver detalle">
                                <Eye className="h-4 w-4" />
                              </Button>
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

        <Sheet open={!!selectedSummary} onOpenChange={(open) => !open && setSelectedSummary(null)}>
          <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">
            {currentOrder && (
              <>
                <div className="bg-background/95 px-4 pb-4 pt-5 sm:px-6">
                  <SheetHeader className="text-left">
                    <div className="pr-8">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
                          {currentOrder.order_origin_channel && <Badge variant="outline">{currentOrder.order_origin_channel}</Badge>}
                          {currentOrder.order_payment_method && <Badge variant="secondary">{currentOrder.order_payment_method}</Badge>}
                        </div>
                        <div className="min-w-0">
                          <SheetTitle className="truncate text-xl font-bold sm:text-2xl">Orden {currentOrder.order_number}</SheetTitle>
                          <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="font-medium text-foreground">{text(currentOrder.buyer_full_name_at_sale, "Cliente sin nombre")}</span>
                            <span className="hidden text-muted-foreground sm:inline">/</span>
                            <span>{formatDate(orderDate(currentOrder))}</span>
                          </SheetDescription>
                        </div>
                      </div>
                    </div>
                  </SheetHeader>
                </div>

                <div className="space-y-5 px-4 py-4 sm:px-6">
                  {detailError && <ModuleErrorCard message={detailError} onRetry={() => selectedSummary && getOrder(selectedSummary.id).then(setSelectedOrder).catch((err) => setDetailError(formatApiErrorMessage(err)))} loading={detailLoading} />}

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <OrderMetric icon={CreditCard} label="Total orden" value={money(currentOrder.doc_total)} note={`${formatCount(currentOrder.line_items_count ?? lineItems.length)} items`} />
                    <OrderMetric icon={Package} label="Items" value={formatCount(currentOrder.line_items_count ?? lineItems.length)} note="Productos y servicios" />
                    <OrderMetric icon={ClipboardList} label="Cantidad total" value={formatCount(currentOrder.line_items_total_quantity)} note="Unidades solicitadas" />
                    <OrderMetric icon={ReceiptText} label="Factura" value={text(currentOrder.sale_invoice_number)} note="Documento asociado" />
                  </div>

                  <Tabs defaultValue="summary">
                    <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/70 p-1">
                      <TabsTrigger value="summary" className="h-10">Resumen</TabsTrigger>
                      <TabsTrigger value="lines" className="h-10">Items</TabsTrigger>
                      <TabsTrigger value="details" className="h-10">Datos adicionales</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-4 space-y-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                      <div className="grid items-stretch gap-3 lg:grid-cols-2">
                        <section className="rounded-md border bg-card p-4 shadow-sm">
                          <div className="mb-3 flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold">Resumen operativo</h3>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <OrderFact label="Identificador" value={currentOrder.order_number} />
                            <OrderFact label="Estado" value={currentStatus.label} />
                            <OrderFact label="Fecha SAP" value={formatDate(currentOrder.sap_doc_date)} />
                            <OrderFact label="Fecha venta" value={formatDate(currentOrder.sell_at)} />
                            <OrderFact label="Canal" value={currentOrder.order_origin_channel ?? currentOrder.sale_origin_channel} />
                            <OrderFact label="Plataforma" value={currentOrder.order_origin_platform ?? currentOrder.sale_origin_platform} />
                          </div>
                        </section>

                        <section className="rounded-md border bg-card p-4 shadow-sm">
                          <div className="mb-3 flex items-center gap-2">
                            <Truck className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold">Entrega</h3>
                          </div>
                          <div className="grid gap-3">
                            <OrderFact label="Direccion" value={currentOrder.order_delivery_address ?? currentOrder.sale_delivery_address} />
                            <OrderFact label="Observaciones" value={currentOrder.order_additional_observations ?? currentOrder.sale_additional_observations} />
                            <OrderFact label="Metodo de pago" value={currentOrder.order_payment_method ?? currentOrder.sale_payment_method} />
                          </div>
                        </section>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <InfoPanel icon={UserRound} title="Cliente" rows={[
                          ["Nombre", currentOrder.buyer_full_name_at_sale],
                          ["Codigo", currentOrder.buyer_internal_code_at_sale],
                          ["Email", currentOrder.buyer_email_at_sale],
                          ["Telefono", currentOrder.buyer_cellphone_at_sale],
                        ]} />
                        <InfoPanel icon={UserRound} title="Representante" rows={[
                          ["Nombre", currentOrder.sales_representative_name],
                          ["Email", currentOrder.sales_representative_email],
                          ["Telefono", currentOrder.sales_representative_phone],
                          ["Tomado por", currentOrder.order_taking_person_name],
                        ]} />
                      </div>
                    </TabsContent>

                    <TabsContent value="lines" className="mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                      {detailLoading && lineItems.length === 0 ? (
                        <div className="h-28 animate-pulse rounded-md bg-muted" />
                      ) : lineItems.length === 0 ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">Esta orden no tiene items registrados.</div>
                      ) : (
                        <div className="overflow-hidden rounded-md border bg-card">
                          <div className="hidden grid-cols-[4rem_minmax(0,1fr)_6rem_7rem_7rem_6rem] bg-muted/60 px-3 py-2.5 text-xs font-semibold text-muted-foreground lg:grid">
                            <span>Item</span>
                            <span>Producto</span>
                            <span>Bodega</span>
                            <span className="text-right">Cant.</span>
                            <span className="text-right">Unitario</span>
                            <span className="text-right">Total</span>
                          </div>
                          {lineItems.map((item, index) => (
                            <div key={`${item.id ?? index}`} className="grid gap-3 border-t px-3 py-3 text-sm lg:grid-cols-[4rem_minmax(0,1fr)_6rem_7rem_7rem_6rem] lg:items-center lg:gap-0">
                              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-bold text-primary">{text(item.line_num ?? index + 1)}</span>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{text(item.sold_product_name_at_order ?? item.sold_service_name, "Producto sin nombre")}</p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Badge variant="outline" className="font-mono text-[10px]">SKU: {text(item.product_catalog_code ?? item.sold_product_sku_at_order ?? item.sold_service_internal_code)}</Badge>
                                  {item.line_item_status_code && <Badge variant={orderStatusInfo(item.line_item_status_code).variant} className="text-[10px]">{orderStatusInfo(item.line_item_status_code).label}</Badge>}
                                  {item.line_item_is_part_of_active_campaign && <Badge className="text-[10px]">Campana</Badge>}
                                </div>
                              </div>
                              <span className="font-mono text-xs text-muted-foreground">{text(item.warehouse_code)}</span>
                              <span className="text-left font-semibold lg:text-right">{formatCount(item.line_item_quantity_sold)}</span>
                              <span className="text-left lg:text-right">{money(item.line_item_unit_price_before_taxes)}</span>
                              <span className="text-left font-semibold lg:text-right">{money(item.line_item_total_price_after_taxes)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="details" className="mt-3 focus-visible:ring-0 focus-visible:ring-offset-0">
                      {additionalFields.length === 0 ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">No hay campos adicionales con informacion para esta orden.</div>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {additionalFields.map(([key, value]) => (
                            <div key={key} className="rounded-md border p-3">
                              <p className="text-xs text-muted-foreground">{labelFor(key)}</p>
                              <p className="break-words text-sm font-medium">{formatField(value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </ErrorDisabledContent>
    </div>
  );
}

function KpiCard({
  title,
  value,
  note,
  icon: Icon,
  loading = false,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-36 animate-pulse rounded-md bg-muted shadow-sm" />
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
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

function RangeFilter({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
  minPlaceholder,
  maxPlaceholder,
  disabled = false,
}: {
  label: string;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder: string;
  maxPlaceholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5 lg:col-span-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" min="0" value={min} onChange={(event) => onMinChange(event.target.value)} placeholder={minPlaceholder} disabled={disabled} />
        <Input type="number" min="0" value={max} onChange={(event) => onMaxChange(event.target.value)} placeholder={maxPlaceholder} disabled={disabled} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-semibold">{value}</p>
    </div>
  );
}

function OrderMetric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="min-h-[7rem] rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-foreground">{value}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 break-words text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function OrderFact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-h-[4rem] min-w-0 rounded-md bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{formatField(value)}</p>
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
  rows: Array<[string, unknown]>;
}) {
  const visibleRows = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="font-semibold">{title}</p>
      </div>
      {visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin informacion disponible.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleRows.map(([label, value]) => (
            <OrderFact key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}
