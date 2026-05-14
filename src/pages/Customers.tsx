import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  CustomerParams,
  CustomerRecord,
  FilterOptionItem,
  CustomerTopProduct,
  getAllRepresentatives,
  getCustomerFilterOptions,
  getCustomersPage,
  listTotal,
  Representative,
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
  ArrowUpAZ,
  BarChart3,
  Building2,
  Copy,
  Download,
  Eye,
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
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { ErrorDisabledContent } from "@/components/common/ErrorDisabledContent";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { formatApiErrorMessage } from "@/lib/errors";
import { buildExportFileName, exportRowsToWorkbook, fetchAllPagesParallel } from "@/lib/export";

const PAGE_SIZE = 200;
const DEFAULT_SALES_REP_FILTER = "assigned";
const WITHOUT_REP_OPTION = "none";
const DEFAULT_MIN_PURCHASES = "1";

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
  customer_average_days_between_purchases: "Promedio de dias entre compras",
  customer_average_purchase_ticket_amount: "Ticket promedio",
  customer_days_since_last_purchase: "Dias desde ultima compra",
  customer_clv_segment: "Segmento CLV",
  customer_rfm_segment: "Segmento RFM",
  customer_estimated_clv: "CLV estimado",
  customer_estimated_rfm: "RFM estimado",
  customer_clv_description: "Descripcion CLV",
  customer_rfm_description: "Descripcion RFM",
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

function yesNo(value: unknown, positive = "Si", negative = "No") {
  if (value === null || value === undefined) return "N/A";
  return Boolean(value) ? positive : negative;
}

function formatPhone(customer: CustomerRecord | null | undefined) {
  const dial = field(customer, "customer_cellphone_country_dial_code", "");
  const phone = field(customer, "customer_cellphone", "");
  return `${dial} ${phone}`.trim() || "N/A";
}

function representativeOption(representative: Representative): [string, string] | null {
  const id = String(representative.sales_representative_id ?? representative.id ?? "");
  const name = String(representative.sales_rep_full_name ?? "");
  return id && name ? [id, name] : null;
}

function customerKey(customer: CustomerRecord) {
  return field(customer, "id", "");
}

function saleAmount(sale: SaleRecord) {
  return sale.sale_total_amount ?? sale.total_amount ?? sale.total_revenue ?? sale.revenue ?? sale.amount ?? sale.sale_subtotal_amount;
}

function customerStatus(customer: CustomerRecord) {
  const isValid = customer.customer_is_valid;
  const isFrozen = customer.customer_is_frozen;
  if (isValid === false && isFrozen === true) {
    return { label: "Inactivo", variant: "secondary" as const };
  } else if (isValid === true && isFrozen === false) {
    return { label: "Activo", variant: "default" as const };
  } else if (isValid === true && isFrozen === true) {
    return { label: "Inactivo", variant: "secondary" as const };
  } else {
    return { label: "Activo", variant: "default" as const };
  }
}

function commercialStatus(customer: CustomerRecord) {
  const days = numeric(customer.customer_days_since_last_purchase);
  if (days > 90) return { label: "Inactivo comercialmente", variant: "secondary" as const };
  if (days > 45) return { label: "En riesgo comercialmente", variant: "outline" as const };
  return { label: "Activo comercialmente", variant: "default" as const };
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

function isNumericLike(value: string) {
  return /^-?\d+([.,]\d+)?$/.test(value.trim());
}

function normalizeSegmentOptions(value: unknown): FilterOptionItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const options: FilterOptionItem[] = [];

  value.forEach((item) => {
    const rawValue =
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "value" in item
          ? String((item as { value: unknown }).value ?? "")
          : "";

    const cleaned = rawValue.trim().toUpperCase();
    if (!cleaned || isNumericLike(cleaned) || seen.has(cleaned)) return;

    seen.add(cleaned);
    options.push({ value: cleaned, label: cleaned });
  });

  return options;
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
    const totalUnits = product.total_units ?? product.quantity ?? product.total_quantity ?? product.qty ?? 0;
    const totalRevenue = product.total_revenue ?? product.revenue ?? product.total_amount ?? product.amount ?? null;
    return {
      product_sku: String(product.product_sku ?? product.sku ?? ""),
      product_commercial_name: String(product.product_commercial_name ?? product.product_name ?? product.product ?? "Producto"),
      product_brand_name: product.product_brand_name != null ? String(product.product_brand_name) : null,
      total_units: Number(totalUnits ?? 0),
      total_revenue: totalRevenue === null || totalRevenue === undefined ? null : Number(totalRevenue),
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

function customerSortParams(value: string): Pick<CustomerParams, "sort_by" | "sort_dir"> {
  if (value === "name_desc") return { sort_by: "name", sort_dir: "desc" };
  if (value === "revenue_desc") return { sort_by: "revenue", sort_dir: "desc" };
  if (value === "purchases_desc") return { sort_by: "purchases", sort_dir: "desc" };
  if (value === "recent_purchase") return { sort_by: "days_since_last_purchase", sort_dir: "asc" };
  return { sort_by: "name", sort_dir: "asc" };
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCustomers, setTotalCustomers] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState({
    businessTypes: [] as string[],
    clvSegments: [] as FilterOptionItem[],
    rfmSegments: [] as FilterOptionItem[],
    representatives: [] as Array<[string, string]>,
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [businessType, setBusinessType] = useState("all");
  const [clvSegment, setClvSegment] = useState("all");
  const [rfmSegment, setRfmSegment] = useState("all");
  const [governmentId, setGovernmentId] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [salesRepId, setSalesRepId] = useState(DEFAULT_SALES_REP_FILTER);
  const [hasLocation, setHasLocation] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [minRevenue, setMinRevenue] = useState("");
  const [maxRevenue, setMaxRevenue] = useState("");
  const [minPurchases, setMinPurchases] = useState(DEFAULT_MIN_PURCHASES);
  const [maxPurchases, setMaxPurchases] = useState("");
  const [minTicket, setMinTicket] = useState("");
  const [maxTicket, setMaxTicket] = useState("");
  const [minDays, setMinDays] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [sortOrder, setSortOrder] = useState("name_asc");

  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [sales] = useState<SaleRecord[]>([]);
  const [tracing] = useState<TracingRecord[]>([]);

  const buildParams = useCallback((offset: number): CustomerParams => ({
    search: search.trim() || undefined,
    business_type: businessType === "all" ? undefined : businessType,
    customer_clv_segment: clvSegment === "all" ? undefined : clvSegment,
    customer_rfm_segment: rfmSegment === "all" ? undefined : rfmSegment,
    government_id: governmentId.trim() || undefined,
    city: city.trim() || undefined,
    state: stateName.trim() || undefined,
    sales_representative_id: optionalNumber(salesRepId),
    has_sales_representative:
      salesRepId === DEFAULT_SALES_REP_FILTER ? true
        : salesRepId === WITHOUT_REP_OPTION ? false
          : undefined,
    has_location: hasLocation === "all" ? undefined : hasLocation === "yes",
    customer_is_valid: showInactive ? undefined : true,
    customer_is_frozen: showInactive ? true : false,
    min_revenue: optionalNumber(minRevenue),
    max_revenue: optionalNumber(maxRevenue),
    min_purchases: optionalNumber(minPurchases) ?? Number(DEFAULT_MIN_PURCHASES),
    max_purchases: optionalNumber(maxPurchases),
    min_average_ticket: optionalNumber(minTicket),
    max_average_ticket: optionalNumber(maxTicket),
    min_days_since_last_purchase: optionalNumber(minDays),
    max_days_since_last_purchase: optionalNumber(maxDays),
    ...customerSortParams(sortOrder),
    limit: PAGE_SIZE,
    offset,
  }), [
    businessType,
    clvSegment,
    city,
    governmentId,
    hasLocation,
    showInactive,
    maxDays,
    maxPurchases,
    maxRevenue,
    maxTicket,
    minDays,
    minPurchases,
    minRevenue,
    minTicket,
    rfmSegment,
    salesRepId,
    search,
    sortOrder,
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
      setError(formatApiErrorMessage(err));
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
    let cancelled = false;

    Promise.allSettled([getCustomerFilterOptions(), getAllRepresentatives()]).then(([typesResult, repsResult]) => {
      if (cancelled) return;

      setFilterOptions({
        businessTypes:
          typesResult.status === "fulfilled" && Array.isArray(typesResult.value.business_types)
            ? typesResult.value.business_types
            : [],
        clvSegments: typesResult.status === "fulfilled" ? normalizeSegmentOptions(typesResult.value.clv_segments) : [],
        rfmSegments: typesResult.status === "fulfilled" ? normalizeSegmentOptions(typesResult.value.rfm_segments) : [],
        representatives:
          repsResult.status === "fulfilled"
            ? [
              [WITHOUT_REP_OPTION, "Sin representante"] as [string, string],
              ...repsResult.value
                .map(representativeOption)
                .filter((item): item is [string, string] => item !== null),
            ]
            : [],
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const businessTypes = filterOptions.businessTypes;
  const clvSegments = filterOptions.clvSegments;
  const rfmSegments = filterOptions.rfmSegments;
  const representatives = filterOptions.representatives;
  const businessTypeOptions = useMemo(() => businessTypes.map((item) => ({ value: item, label: item })), [businessTypes]);
  const clvSegmentOptions = useMemo(() => clvSegments, [clvSegments]);
  const rfmSegmentOptions = useMemo(() => rfmSegments, [rfmSegments]);
  const representativeOptions = useMemo(
    () => representatives.map(([id, name]) => ({ value: id, label: name })),
    [representatives],
  );
  const clvSegmentLabel = clvSegments.find((item) => item.value === clvSegment)?.label ?? clvSegment;
  const rfmSegmentLabel = rfmSegments.find((item) => item.value === rfmSegment)?.label ?? rfmSegment;

  const totalRevenue = customers.reduce((sum, item) => sum + numeric(item.customer_total_lifetime_revenue), 0);
  const totalPurchases = customers.reduce((sum, item) => sum + numeric(item.customer_total_number_of_purchases), 0);
  const averageTicket = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
  const totalLabel = totalCustomers === null ? null : totalCustomers.toLocaleString("es-CO");
  const loadedLabel = customers.length.toLocaleString("es-CO");
  const lifecycleValue =
    minDays === "1" && maxDays === "45" ? "active"
      : minDays === "46" && maxDays === "90" ? "risk"
        : minDays === "91" && maxDays === "" ? "inactive"
          : "custom";
  const advancedFilterCount = [
    clvSegment !== "all",
    rfmSegment !== "all",
    governmentId.trim(),
    city.trim(),
    stateName.trim(),
    hasLocation !== "all",
    minRevenue,
    maxRevenue,
    minPurchases !== DEFAULT_MIN_PURCHASES && minPurchases,
    maxPurchases,
    minTicket,
    maxTicket,
    minDays,
    maxDays,
  ].filter(Boolean).length;
  const activeFilters = [
    search.trim() && { key: "search", label: `Busqueda: ${search.trim()}`, clear: () => { setSearch(""); setSearchInput(""); } },
    businessType !== "all" && { key: "businessType", label: `Tipo: ${businessType}`, clear: () => setBusinessType("all") },
    clvSegment !== "all" && { key: "clvSegment", label: `CLV: ${clvSegmentLabel}`, clear: () => setClvSegment("all") },
    rfmSegment !== "all" && { key: "rfmSegment", label: `RFM: ${rfmSegmentLabel}`, clear: () => setRfmSegment("all") },
    salesRepId === WITHOUT_REP_OPTION && { key: "salesRepId", label: "Sin representante", clear: () => setSalesRepId(DEFAULT_SALES_REP_FILTER) },
    salesRepId !== "all" && salesRepId !== DEFAULT_SALES_REP_FILTER && salesRepId !== WITHOUT_REP_OPTION && {
      key: "salesRepId",
      label: `Rep: ${representatives.find(([id]) => id === salesRepId)?.[1] ?? salesRepId}`,
      clear: () => setSalesRepId(DEFAULT_SALES_REP_FILTER),
    },
    governmentId.trim() && { key: "governmentId", label: `NIT: ${governmentId.trim()}`, clear: () => setGovernmentId("") },
    city.trim() && { key: "city", label: `Ciudad: ${city.trim()}`, clear: () => setCity("") },
    stateName.trim() && { key: "stateName", label: `Departamento: ${stateName.trim()}`, clear: () => setStateName("") },
    hasLocation !== "all" && { key: "hasLocation", label: hasLocation === "yes" ? "Con ubicacion" : "Sin ubicacion", clear: () => setHasLocation("all") },
    showInactive && { key: "showInactive", label: "Inactivos", clear: () => setShowInactive(false) },
    lifecycleValue === "active" && { key: "lifecycle", label: "Estado: Activo comercialmente", clear: () => setLifecycleFilter("custom") },
    lifecycleValue === "risk" && { key: "lifecycle", label: "Estado: En riesgo comercialmente", clear: () => setLifecycleFilter("custom") },
    lifecycleValue === "inactive" && { key: "lifecycle", label: "Estado: Inactivo comercialmente", clear: () => setLifecycleFilter("custom") },
    minRevenue && { key: "minRevenue", label: `Ingresos >= ${money(minRevenue)}`, clear: () => setMinRevenue("") },
    maxRevenue && { key: "maxRevenue", label: `Ingresos <= ${money(maxRevenue)}`, clear: () => setMaxRevenue("") },
    minPurchases !== DEFAULT_MIN_PURCHASES && minPurchases && { key: "minPurchases", label: `Compras >= ${minPurchases}`, clear: () => setMinPurchases(DEFAULT_MIN_PURCHASES) },
    maxPurchases && { key: "maxPurchases", label: `Compras <= ${maxPurchases}`, clear: () => setMaxPurchases("") },
    minTicket && { key: "minTicket", label: `Ticket >= ${money(minTicket)}`, clear: () => setMinTicket("") },
    maxTicket && { key: "maxTicket", label: `Ticket <= ${money(maxTicket)}`, clear: () => setMaxTicket("") },
    lifecycleValue === "custom" && minDays && { key: "minDays", label: `Dias >= ${minDays}`, clear: () => setMinDays("") },
    lifecycleValue === "custom" && maxDays && { key: "maxDays", label: `Dias <= ${maxDays}`, clear: () => setMaxDays("") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const setLifecycleFilter = (value: string) => {
    if (value === "active") {
      setMinDays("1");
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

  const commitSearch = () => setSearch(searchInput.trim());

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setBusinessType("all");
    setClvSegment("all");
    setRfmSegment("all");
    setGovernmentId("");
    setCity("");
    setStateName("");
    setSalesRepId(DEFAULT_SALES_REP_FILTER);
    setHasLocation("all");
    setShowInactive(false);
    setMinRevenue("");
    setMaxRevenue("");
    setMinPurchases(DEFAULT_MIN_PURCHASES);
    setMaxPurchases("");
    setMinTicket("");
    setMaxTicket("");
    setMinDays("");
    setMaxDays("");
  };

  const exportCustomers = useCallback(async () => {
    setExporting(true);
    try {
      const rows = await fetchAllPagesParallel(getCustomersPage, buildParams(0));
      exportRowsToWorkbook(
        rows,
        [
          { header: "ID interno", value: (customer) => field(customer, "id", "") },
          { header: "Documento / NIT", value: (customer) => field(customer, "customer_government_id", "") },
          { header: "Cliente", value: (customer) => field(customer, "customer_full_name", "") },
          { header: "Tipo de negocio", value: (customer) => field(customer, "customer_business_type", "") },
          { header: "Celular", value: (customer) => formatPhone(customer) },
          { header: "Email", value: (customer) => field(customer, "customer_email", "") },
          { header: "Direccion comercial", value: (customer) => field(customer, "customer_business_address", "") },
          { header: "Ciudad", value: (customer) => field(customer, "customer_business_city", "") },
          { header: "Departamento", value: (customer) => field(customer, "customer_business_state", "") },
          { header: "Representante", value: (customer) => field(customer, "sales_rep_full_name", "") },
          { header: "Cobertura representante", value: (customer) => field(customer, "sales_rep_coverage_area", "") },
          { header: "Estado ERP", value: (customer) => customerStatus(customer).label },
          { header: "Estado comercial", value: (customer) => commercialStatus(customer).label },
          { header: "Ingresos acumulados", value: (customer) => numeric(customer.customer_total_lifetime_revenue) },
          { header: "Compras realizadas", value: (customer) => numeric(customer.customer_total_number_of_purchases) },
          { header: "Ticket promedio", value: (customer) => numeric(customer.customer_average_purchase_ticket_amount) },
          { header: "Dias sin compra", value: (customer) => numeric(customer.customer_days_since_last_purchase) },
          { header: "Promedio dias entre compras", value: (customer) => numeric(customer.customer_average_days_between_purchases) },
          { header: "Segmento CLV", value: (customer) => field(customer, "customer_clv_segment", "") },
          { header: "Segmento RFM", value: (customer) => field(customer, "customer_rfm_segment", "") },
          { header: "CLV estimado", value: (customer) => numeric(customer.customer_estimated_clv) },
          { header: "RFM score", value: (customer) => field(customer, "customer_estimated_rfm", "") },
          { header: "Billetera confirmada", value: (customer) => yesNo(customer.customer_has_confirmed_digital_wallet) },
          { header: "Email billetera", value: (customer) => field(customer, "customer_wallet_confirmation_email", "") },
          { header: "Con ubicacion", value: (customer) => yesNo(hasCoordinates(customer)) },
          { header: "Latitud", value: (customer) => field(customer, "customer_business_latitude", "") },
          { header: "Longitud", value: (customer) => field(customer, "customer_business_longitude", "") },
          { header: "Creado", value: (customer) => field(customer, "created_at", "") },
          { header: "Actualizado", value: (customer) => field(customer, "updated_at", "") },
        ],
        buildExportFileName("clientes"),
        "Clientes",
      );
      toast.success(`Se exportaron ${rows.length.toLocaleString("es-CO")} clientes`);
    } catch (err) {
      toast.error(formatApiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }, [buildParams]);

  const openProfile = (customer: CustomerRecord) => {
    setSelected(customer);
  };

  const currentProfile = selected;
  const additionalFields = Object.entries(currentProfile ?? {}).filter(([key, value]) => !CORE_CUSTOMER_FIELDS.has(key) && value !== null && value !== undefined && value !== "");
  const profileStatus = currentProfile ? customerStatus(currentProfile) : null;
  const profileCommercialStatus = currentProfile ? commercialStatus(currentProfile) : null;
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
      <ErrorDisabledContent disabled={!!error}>
        <PageHeader
          icon={UserRound}
          title="Clientes"
          description="Analiza, segmenta y prioriza clientes comerciales"
          actions={(
            <Button onClick={() => void exportCustomers()} disabled={loadingInitial || exporting} className="w-full gap-2 md:w-auto">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exportando..." : "Exportar"}
            </Button>
          )}
        />
      </ErrorDisabledContent>

      {error && (
        <ModuleErrorCard message={error} onRetry={() => fetchPage(0, "reset")} loading={loadingInitial} />
      )}

      <ErrorDisabledContent disabled={!!error} className="space-y-5 sm:space-y-6">
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
            <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_220px_260px_240px_auto]">
              <div className="relative min-w-0">
                <button type="button" onClick={commitSearch} disabled={loadingInitial} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
                  <Search className="h-4 w-4" />
                </button>
                <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitSearch()} disabled={loadingInitial} placeholder="Buscar por nombre, NIT, email o celular" className="h-10 pl-9 pr-9" />
                {search && (
                  <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <SearchableSelect
                value={businessType}
                onValueChange={setBusinessType}
                options={businessTypeOptions}
                allLabel="Todos los tipos"
                searchPlaceholder="Buscar tipo..."
                emptyLabel="No hay tipos"
                disabled={loadingInitial}
              />
              <SearchableSelect
                value={salesRepId}
                onValueChange={setSalesRepId}
                options={representativeOptions}
                allLabel="Todos los representantes"
                searchPlaceholder="Buscar representante..."
                emptyLabel="No hay representantes"
                disabled={loadingInitial}
              />
              <Select value={sortOrder} onValueChange={setSortOrder} disabled={loadingInitial}>
                <SelectTrigger className="h-10 w-full">
                  <ArrowUpAZ className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">Ordenar por nombre A-Z</SelectItem>
                  <SelectItem value="name_desc">Ordenar por nombre Z-A</SelectItem>
                  <SelectItem value="revenue_desc">Ordenar por ingresos</SelectItem>
                  <SelectItem value="purchases_desc">Ordenar por compras</SelectItem>
                  <SelectItem value="recent_purchase">Ordenar por compra reciente</SelectItem>
                </SelectContent>
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
                      {advancedFilterCount > 0 ? (
                        <Button variant="ghost" size="sm" onClick={clearFilters} disabled={loadingInitial} className="w-full gap-2 sm:w-auto">
                          <X className="h-4 w-4" /> Limpiar todo
                        </Button>
                      ) : null}
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

                    <FilterSection icon={Activity} title="Segmentacion comercial">
                      <FilterField label="Segmento CLV">
                        <SearchableSelect
                          value={clvSegment}
                          onValueChange={setClvSegment}
                          options={clvSegmentOptions}
                          allLabel="Todos los segmentos CLV"
                          searchPlaceholder="Buscar CLV..."
                          emptyLabel="No hay segmentos CLV"
                          disabled={loadingInitial}
                        />
                      </FilterField>
                      <FilterField label="Segmento RFM">
                        <SearchableSelect
                          value={rfmSegment}
                          onValueChange={setRfmSegment}
                          options={rfmSegmentOptions}
                          allLabel="Todos los segmentos RFM"
                          searchPlaceholder="Buscar RFM..."
                          emptyLabel="No hay segmentos RFM"
                          disabled={loadingInitial}
                        />
                      </FilterField>
                    </FilterSection>

                    <Separator />

                    <FilterSection icon={RefreshCw} title="Recencia">
                      <FilterField label="Estado comercial">
                        <Select value={lifecycleValue} onValueChange={setLifecycleFilter} disabled={loadingInitial}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Personalizado</SelectItem>
                            <SelectItem value="active">Activo comercialmente: hasta 45 dias</SelectItem>
                            <SelectItem value="risk">En riesgo comercialmente: 46 a 90 dias</SelectItem>
                            <SelectItem value="inactive">Inactivo comercialmente: 91+ dias</SelectItem>
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
              <Button type="button" size="sm" variant={hasLocation === "yes" ? "default" : "outline"} onClick={() => setHasLocation(hasLocation === "yes" ? "all" : "yes")} disabled={loadingInitial} className="h-8 gap-2"><MapPinned className="h-3.5 w-3.5" /> Con ubicacion</Button>
              <Button type="button" size="sm" variant={showInactive ? "default" : "outline"} onClick={() => setShowInactive(!showInactive)} disabled={loadingInitial} className="h-8">Inactivos</Button>
            </div>

            {activeFilters.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                {activeFilters.map((filter) => (
                  <button key={filter.key} type="button" onClick={filter.clear} disabled={loadingInitial} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15">
                    <span className="truncate">{filter.label}</span>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                ))}
                <button type="button" onClick={clearFilters} disabled={loadingInitial} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" /> Limpiar
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 sm:p-6 sm:pt-0">
            {loadingInitial ? (
              <div className="space-y-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-muted" />)}</div>
            ) : customers.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
                <UserRound className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">{activeFilters.length > 0 ? "No encontramos clientes con los filtros aplicados" : "Aun no hay clientes disponibles para tu alcance"}</p>
                {activeFilters.length > 0 && <Button variant="outline" className="mt-4" onClick={clearFilters} disabled={loadingInitial}><X className="h-4 w-4 mr-2" />Limpiar filtros</Button>}
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {customers.map((customer) => {
                    const status = customerStatus(customer);
                    const commercial = commercialStatus(customer);
                    return (
                      <div key={field(customer, "id")} className="rounded-md border bg-card p-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{field(customer, "customer_full_name", "Cliente sin nombre")}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{field(customer, "customer_email", field(customer, "customer_cellphone"))}</p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <Badge variant={commercial.variant}>{commercial.label}</Badge>
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
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Representante</TableHead>
                        <TableHead>Compras</TableHead>
                        <TableHead>Ticket prom.</TableHead>
                        <TableHead>Últ. compra</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => {
                        const status = customerStatus(customer);
                        return (
                          <TableRow key={field(customer, "id")} className="group">
                            <TableCell className="max-w-[260px]">
                              <div className="flex flex-col gap-1">
                                <p className="truncate font-medium">{field(customer, "customer_full_name", "Cliente sin nombre")}</p>
                                <p className="truncate text-xs text-muted-foreground">{field(customer, "customer_email", field(customer, "customer_cellphone"))}</p>
                              </div>
                            </TableCell>
                            <TableCell>{field(customer, "customer_government_id")}</TableCell>
                            <TableCell>{field(customer, "sales_rep_full_name")}</TableCell>
                            <TableCell className="text-center">{numeric(customer.customer_total_number_of_purchases).toLocaleString("es-CO")}</TableCell>
                            <TableCell className="text-center">{money(customer.customer_average_purchase_ticket_amount)}</TableCell>
                            <TableCell className="text-center">{numeric(customer.customer_days_since_last_purchase)} d</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </TableCell>
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
          <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">
            {selected && (
              <>
                <div className="bg-background px-4 pb-4 pt-5 sm:px-6">
                  <SheetHeader className="text-left">
                    <div className="pr-8">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {profileStatus && <Badge variant={profileStatus.variant}>{profileStatus.label}</Badge>}
                          {profileCluster && <Badge variant="outline">{profileCluster}</Badge>}
                        </div>
                        <div className="min-w-0">
                          <SheetTitle className="truncate text-xl font-bold sm:text-2xl">{field(currentProfile, "customer_full_name", "Cliente sin nombre")}</SheetTitle>
                          <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="font-medium text-foreground">{field(currentProfile, "customer_government_id")}</span>
                            <span className="hidden text-muted-foreground sm:inline">/</span>
                            <span>{field(currentProfile, "customer_business_type")}</span>
                          </SheetDescription>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => copyText(field(currentProfile, "customer_government_id", ""), "NIT")} title="Copiar NIT"><Copy className="h-4 w-4" /> NIT</Button>
                          {field(currentProfile, "customer_email", "") && <Button variant="outline" size="sm" className="h-9 gap-2" asChild title="Email"><a href={`mailto:${field(currentProfile, "customer_email", "")}`}><Mail className="h-4 w-4" /> Email</a></Button>}
                          {field(currentProfile, "customer_cellphone", "") && <Button variant="outline" size="sm" className="h-9 gap-2" asChild title="Llamar"><a href={`tel:${field(currentProfile, "customer_cellphone_country_dial_code", "")}${field(currentProfile, "customer_cellphone", "")}`}><Phone className="h-4 w-4" /> Llamar</a></Button>}
                        </div>
                      </div>
                    </div>
                  </SheetHeader>
                </div>

                <div className="space-y-5 px-4 py-4 sm:px-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ProfileMetric label="Ingresos" value={money(currentProfile?.customer_total_lifetime_revenue)} />
                    <ProfileMetric label="Compras" value={numeric(currentProfile?.customer_total_number_of_purchases).toLocaleString("es-CO")} />
                    <ProfileMetric label="Ticket prom." value={money(currentProfile?.customer_average_purchase_ticket_amount)} />
                    <ProfileMetric label="Ultima compra" value={`${numeric(currentProfile?.customer_days_since_last_purchase)} d`} />
                  </div>

                  <Tabs defaultValue="summary">
                    <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/70 p-1">
                      <TabsTrigger value="summary" className="h-10 min-w-max snap-start">Resumen</TabsTrigger>
                      <TabsTrigger value="performance" className="h-10 min-w-max snap-start">Rendimiento</TabsTrigger>
                      <TabsTrigger value="products" className="h-10 min-w-max snap-start">Productos top</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-4 space-y-3 focus-visible:ring-0 focus-visible:ring-offset-0">
                      <div className="grid items-stretch gap-3 lg:grid-cols-2">
                        <InfoPanel icon={Building2} title="Identidad comercial" rows={[
                          ["Tipo de negocio", field(currentProfile, "customer_business_type")],
                          ["Documento / NIT", field(currentProfile, "customer_government_id")],
                          ["Representante", field(currentProfile, "sales_rep_full_name", "Sin asignar")],
                          ["Cobertura", field(currentProfile, "sales_rep_coverage_area", "Sin zona")],
                        ]} />
                        <InfoPanel icon={MapPin} title="Ubicacion" rows={[
                          ["Ciudad", field(currentProfile, "customer_business_city")],
                          ["Departamento", field(currentProfile, "customer_business_state")],
                          ["Direccion", field(currentProfile, "customer_business_address")],
                          ["Georreferenciado", hasCoordinates(currentProfile) ? "Si" : "No"],
                        ]} />
                      </div>
                      <div className="grid items-stretch gap-3 lg:grid-cols-2">
                        <InfoPanel icon={WalletCards} title="Contacto y billetera" rows={[
                          ["Email", field(currentProfile, "customer_email")],
                          ["Celular", formatPhone(currentProfile)],
                          ["Billetera confirmada", yesNo(currentProfile?.customer_has_confirmed_digital_wallet)],
                          ["Email billetera", field(currentProfile, "customer_wallet_confirmation_email")],
                        ]} />
                        <InfoPanel icon={BarChart3} title="Segmentacion comercial" rows={[
                          ["CLV actual", field(currentProfile, "customer_clv_segment")],
                          ["CLV estimado", money(currentProfile?.customer_estimated_clv)],
                          ["RFM actual", field(currentProfile, "customer_rfm_segment")],
                          ["RFM estimado", field(currentProfile, "customer_estimated_rfm")],
                        ]} />
                      </div>
                    </TabsContent>

                    <TabsContent value="performance" className="mt-4 space-y-3 focus-visible:ring-0 focus-visible:ring-offset-0">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InsightCard title="Estado comercial" value={profileCommercialStatus?.label || "N/A"} note="Basado en dias desde la ultima compra" icon={Activity} />
                        <InsightCard title="Oportunidad" value={numeric(currentProfile?.customer_days_since_last_purchase) > 60 ? "Reactivar" : "Mantener"} note="Prioriza seguimiento segun recencia" icon={TrendingUp} />
                        <InsightCard title="CLV" value={field(currentProfile, "customer_clv_segment", "Sin segmento")} note={field(currentProfile, "customer_clv_description", "Sin descripcion disponible")} icon={UserRound} />
                        <InsightCard title="RFM" value={field(currentProfile, "customer_rfm_segment", "Sin segmento")} note={field(currentProfile, "customer_rfm_description", "Sin descripcion disponible")} icon={RefreshCw} />
                      </div>
                    </TabsContent>

                    <TabsContent value="products" className="mt-4 space-y-2 focus-visible:ring-0 focus-visible:ring-offset-0">
                      {topProducts.length > 0 ? (
                        <div className="overflow-hidden rounded-md border">
                          <div className="grid grid-cols-[2.5rem_1fr_5rem_7rem] bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                            <span>#</span>
                            <span>Producto</span>
                            <span className="text-right">Cantidad</span>
                            <span className="text-right">Revenue</span>
                          </div>
                          {topProducts.map((product, index) => (
                            <div key={`${product.product_commercial_name}-${index}`} className="grid grid-cols-[2.5rem_1fr_5rem_7rem] items-center border-t px-3 py-2.5">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{product.product_commercial_name || "Producto"}</p>
                                {product.product_brand_name && <p className="truncate text-xs text-muted-foreground">{product.product_brand_name}</p>}
                              </div>
                              <p className="text-right text-sm">{numeric(product.total_units).toLocaleString("es-CO")}</p>
                              <p className="text-right text-sm">{money(product.total_revenue)}</p>
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
      </ErrorDisabledContent>
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
    <div className="min-h-[7rem] rounded-md border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-xl font-bold leading-tight text-foreground">{value}</p>
    </div>
  );
}

function CustomerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[4rem] rounded-md bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{value || "N/A"}</p>
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
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><p className="font-semibold">{title}</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <CustomerFact key={label} label={label} value={value} />
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
    <div className="min-h-[7rem] rounded-md border bg-card p-4 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="break-words text-xl font-bold leading-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
