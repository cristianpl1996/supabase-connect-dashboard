import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  getProductFilterOptions,
  getProductsPage,
  getSupabaseProduct,
  listTotal,
  ProductCatalogItem,
  ProductInventoryLocation,
  ProductListParams,
  SupabaseProduct,
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
  ArrowUpAZ,
  BadgeCheck,
  Boxes,
  Eye,
  ImageOff,
  Layers3,
  Loader2,
  Package,
  Search,
  SlidersHorizontal,
  Tags,
  X,
} from "lucide-react";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { ErrorDisabledContent } from "@/components/common/ErrorDisabledContent";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { formatApiErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 200;
const SUPABASE_PUBLIC_URL = (
  import.meta.env.VITE_SUPABASE_PUBLIC_URL as string | undefined
) ?? "https://supabase.bettercode.com.co";
const PRODUCT_IMAGE_BUCKET = (
  import.meta.env.VITE_SUPABASE_PRODUCT_IMAGE_BUCKET as string | undefined
) ?? "product-images";
const CORE_PRODUCT_FIELDS = new Set([
  "product_sku",
  "product_commercial_name",
  "product_technical_description",
  "product_unit_of_measurement",
  "product_brand_name",
  "product_industry_sector",
  "product_category",
  "product_line_name",
  "product_target_species",
  "product_target_animal_species",
  "product_substitute_skus",
  "product_recommended_application_frequency",
  "is_catalog_verified",
  "is_discontinued",
  "product_is_catalog_verified",
  "product_is_discontinued",
  "external_product_id",
  "metadata",
  "total_units_available",
  "units_available_in_stock",
  "inventory_locations_count",
  "max_units_in_single_inventory",
  "ordered_quantity",
  "committed_quantity",
  "minimal_stock",
  "maximal_stock",
  "min_unit_sale_price",
  "max_unit_sale_price",
  "avg_unit_sale_price",
  "min_standard_average_price",
  "max_standard_average_price",
  "avg_standard_average_price",
  "inventories",
  "price_lists_count",
  "price_lists",
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

function formatDate(value: unknown) {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return text(value);
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

function formatCount(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-CO");
}

function money(value: unknown) {
  const amount = numberValue(value);
  if (amount <= 0) return "N/A";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function uniqueValues(items: ProductCatalogItem[], key: keyof ProductCatalogItem) {
  return Array.from(new Set(items.map((item) => text(item[key], "")).filter(Boolean))).sort();
}

function productKey(product: ProductCatalogItem) {
  return product.product_sku;
}

function productStatus(product: ProductCatalogItem) {
  if ((product.is_discontinued ?? product.product_is_discontinued) === true) return { label: "Descontinuado", variant: "secondary" as const };
  if ((product.is_catalog_verified ?? product.product_is_catalog_verified) === true) return { label: "Verificado", variant: "default" as const };
  return { label: "Catalogo", variant: "outline" as const };
}

function normalizeInventories(product: ProductCatalogItem | null): ProductInventoryLocation[] {
  const value = product?.inventories;
  if (!value) return [];
  if (Array.isArray(value)) return value as ProductInventoryLocation[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as ProductInventoryLocation[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizePriceLists(product: ProductCatalogItem | null): Record<string, unknown>[] {
  const value = product?.price_lists;
  if (!value) return [];
  if (Array.isArray(value)) return summarizePriceLists(value as Record<string, unknown>[]);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? summarizePriceLists(parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function summarizePriceLists(rows: Record<string, unknown>[]) {
  const seen = new Map<string, Record<string, unknown>>();
  rows.forEach((row) => {
    const listId = text(row.sap_price_list ?? row.price_list_code ?? row.price_list, "");
    if (!listId) return;
    if (!seen.has(listId)) {
      seen.set(listId, {
        sap_price_list: listId,
        sap_price: row.sap_price ?? row.price ?? row.unit_price ?? null,
      });
    }
  });
  return Array.from(seen.values()).sort((a, b) => text(a.sap_price_list, "").localeCompare(text(b.sap_price_list, ""), "es-CO", { numeric: true }));
}

function labelFor(key: string) {
  const labels: Record<string, string> = {
    product_sku: "SKU",
    customer_id: "Cliente",
    price_list: "Lista",
    price_list_code: "Lista",
    sap_price_list: "Lista SAP",
    sap_price: "Precio SAP",
    warehouse_code: "Bodega",
    currency: "Moneda",
    price: "Precio",
    unit_price: "Precio unitario",
    created_at: "Creado",
    updated_at: "Actualizado",
  };
  return labels[key] ?? key.replace(/^product_/, "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

function resolveExternalProductImageUrl(imagePath?: unknown) {
  if (typeof imagePath !== "string") return null;
  const path = imagePath.trim();
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;

  const cleanBase = SUPABASE_PUBLIC_URL.replace(/\/+$/, "");
  const cleanBucket = PRODUCT_IMAGE_BUCKET.replace(/^\/+|\/+$/g, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}/storage/v1/object/public/${cleanBucket}/${cleanPath}`;
}

function productSortParams(value: string): Pick<ProductListParams, "sort_by" | "sort_dir"> {
  if (value === "name_desc") return { sort_by: "name", sort_dir: "desc" };
  if (value === "available_desc") return { sort_by: "available", sort_dir: "desc" };
  if (value === "available_asc") return { sort_by: "available", sort_dir: "asc" };
  return { sort_by: "name", sort_dir: "asc" };
}

export default function Products() {
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState({ brands: [] as string[], categories: [] as string[] });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [search, setSearch] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [line, setLine] = useState("all");
  const [species, setSpecies] = useState("all");
  const [status, setStatus] = useState("all");
  const [verification, setVerification] = useState("all");
  const [inventoryStatus, setInventoryStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("name_asc");
  const [minUnits, setMinUnits] = useState("");
  const [maxUnits, setMaxUnits] = useState("");
  const [selected, setSelected] = useState<ProductCatalogItem | null>(null);
  const [externalProduct, setExternalProduct] = useState<SupabaseProduct | null>(null);
  const [externalProductLoading, setExternalProductLoading] = useState(false);
  const [externalProductError, setExternalProductError] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const buildParams = useCallback((offset: number): ProductListParams => ({
    sku: sku.trim() || undefined,
    search: search.trim() || undefined,
    brand_name: brand === "all" ? undefined : brand,
    category: category === "all" ? undefined : category,
    line_name: line === "all" ? undefined : line,
    target_species: species === "all" ? undefined : species,
    is_catalog_verified: verification === "verified" ? true : verification === "unverified" ? false : undefined,
    is_discontinued: status === "active" ? false : status === "discontinued" ? true : undefined,
    has_inventory: inventoryStatus === "with_inventory" || inventoryStatus === "in_stock" ? true : inventoryStatus === "without_inventory" ? false : undefined,
    in_stock_only: inventoryStatus === "in_stock" ? true : undefined,
    min_units: optionalNumber(minUnits),
    max_units: optionalNumber(maxUnits),
    ...productSortParams(sortOrder),
    limit: PAGE_SIZE,
    offset,
  }), [brand, category, inventoryStatus, line, maxUnits, minUnits, search, sku, sortOrder, species, status, verification]);

  const fetchPage = useCallback(async (offset: number, mode: "reset" | "append") => {
    if (mode === "reset") {
      setLoadingInitial(true);
      setError(null);
      setProducts([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await getProductsPage(buildParams(offset));
      const batch = response.data ?? [];
      const total = listTotal(response);

      setTotalProducts(total);
      setProducts((prev) => {
        const base = mode === "reset" ? [] : prev;
        const seen = new Set(base.map(productKey));
        const next = [...base];
        batch.forEach((item) => {
          if (!seen.has(productKey(item))) {
            seen.add(productKey(item));
            next.push(item);
          }
        });
        return next;
      });
      setHasMore(total === null ? batch.length === PAGE_SIZE : offset + batch.length < total);
    } catch (err) {
      setError(formatApiErrorMessage(err));
      if (mode === "reset") {
        setProducts([]);
        setTotalProducts(null);
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
    getProductFilterOptions()
      .then((options) => {
        if (cancelled) return;
        setFilterOptions({
          brands: Array.isArray(options.brands) ? options.brands : [],
          categories: Array.isArray(options.categories) ? options.categories : [],
        });
      })
      .catch(() => {
        if (!cancelled) setFilterOptions({ brands: [], categories: [] });
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
        void fetchPage(products.length, "append");
      }
    }, { rootMargin: "240px" });

    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loadingInitial, loadingMore, products.length]);

  useEffect(() => {
    const externalId = selected?.external_product_id;
    setExternalProduct(null);
    setExternalProductError(null);
    setImageLoadFailed(false);

    if (!selected || !externalId) {
      setExternalProductLoading(false);
      return;
    }

    const productId = Number(externalId);
    if (!Number.isFinite(productId)) {
      setExternalProductLoading(false);
      setExternalProductError("ID externo invalido");
      return;
    }

    let cancelled = false;
    setExternalProductLoading(true);
    getSupabaseProduct(productId)
      .then((product) => {
        if (cancelled) return;
        setExternalProduct(product);
      })
      .catch((err) => {
        if (cancelled) return;
        setExternalProductError(formatApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setExternalProductLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const brands = filterOptions.brands;
  const categories = filterOptions.categories;
  const brandOptions = useMemo(() => brands.map((item) => ({ value: item, label: item })), [brands]);
  const categoryOptions = useMemo(() => categories.map((item) => ({ value: item, label: item })), [categories]);
  const lines = useMemo(() => uniqueValues(products, "product_line_name"), [products]);
  const speciesOptions = useMemo(() => uniqueValues(products, "product_target_species"), [products]);
  const visibleBrandCount = useMemo(() => uniqueValues(products, "product_brand_name").length, [products]);
  const totalStock = products.reduce((sum, item) => sum + numberValue(item.total_units_available ?? item.units_available_in_stock), 0);
  const inventoryLocations = products.reduce((sum, item) => sum + numberValue(item.inventory_locations_count), 0);
  const productsWithStock = products.filter((item) => numberValue(item.total_units_available ?? item.units_available_in_stock) > 0).length;
  const stockCoverage = products.length > 0 ? Math.round((productsWithStock / products.length) * 100) : 0;
  const averageLocations = products.length > 0 ? inventoryLocations / products.length : 0;
  const selectedInventories = normalizeInventories(selected);
  const selectedPriceLists = normalizePriceLists(selected);
  const externalImageUrl = resolveExternalProductImageUrl(externalProduct?.image_path);
  const priceListColumns = selectedPriceLists.length > 0 ? ["sap_price_list", "sap_price"] : [];
  const selectedStatus = selected ? productStatus(selected) : null;
  const additionalFields = selected
    ? Object.entries(selected).filter(([key, value]) => !CORE_PRODUCT_FIELDS.has(key) && value !== null && value !== undefined && value !== "")
    : [];
  const advancedFilterCount = [
    sku.trim(),
    line !== "all",
    species !== "all",
    status !== "all",
    verification !== "all",
    inventoryStatus !== "all",
    minUnits,
    maxUnits,
  ].filter(Boolean).length;
  const activeFilters = [
    search.trim() && { key: "search", label: `Busqueda: ${search.trim()}`, clear: () => setSearch("") },
    sku.trim() && { key: "sku", label: `SKU: ${sku.trim()}`, clear: () => setSku("") },
    brand !== "all" && { key: "brand", label: `Marca: ${brand}`, clear: () => setBrand("all") },
    category !== "all" && { key: "category", label: `Categoria: ${category}`, clear: () => setCategory("all") },
    line !== "all" && { key: "line", label: `Linea: ${line}`, clear: () => setLine("all") },
    species !== "all" && { key: "species", label: `Especie: ${species}`, clear: () => setSpecies("all") },
    status === "active" && { key: "status", label: "Estado: Activos", clear: () => setStatus("all") },
    status === "discontinued" && { key: "status", label: "Estado: Descontinuados", clear: () => setStatus("all") },
    verification === "verified" && { key: "verification", label: "Catalogo: Verificados", clear: () => setVerification("all") },
    verification === "unverified" && { key: "verification", label: "Catalogo: Sin verificar", clear: () => setVerification("all") },
    inventoryStatus === "in_stock" && { key: "inventoryStatus", label: "Inventario: Con stock", clear: () => setInventoryStatus("all") },
    inventoryStatus === "with_inventory" && { key: "inventoryStatus", label: "Inventario: Con bodegas", clear: () => setInventoryStatus("all") },
    inventoryStatus === "without_inventory" && { key: "inventoryStatus", label: "Inventario: Sin bodegas", clear: () => setInventoryStatus("all") },
    minUnits && { key: "minUnits", label: `Disponible >= ${minUnits}`, clear: () => setMinUnits("") },
    maxUnits && { key: "maxUnits", label: `Disponible <= ${maxUnits}`, clear: () => setMaxUnits("") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const clearFilters = () => {
    setSearch("");
    setSku("");
    setBrand("all");
    setCategory("all");
    setLine("all");
    setSpecies("all");
    setStatus("all");
    setVerification("all");
    setInventoryStatus("all");
    setMinUnits("");
    setMaxUnits("");
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={!!error}>
      <PageHeader
        icon={Package}
        title="Catalogo de Productos"
        description="Consulta la informacion de los productos, incluyendo su disponibilidad, pedidos y bodegas reales."
      />
      </ErrorDisabledContent>

      {error && (
        <ModuleErrorCard message={error} onRetry={() => fetchPage(0, "reset")} loading={loadingInitial} />
      )}

      <ErrorDisabledContent disabled={!!error} className="space-y-5 sm:space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Productos cargados" value={`${formatCount(products.length)} / ${totalProducts === null ? "..." : formatCount(totalProducts)}`} note="Segun filtros actuales" icon={Package} loading={loadingInitial} />
        <KpiCard title="Con stock disponible" value={`${stockCoverage}%`} note={`${formatCount(productsWithStock)} SKUs con unidades`} icon={Boxes} loading={loadingInitial} />
        <KpiCard title="Bodegas con inventario" value={formatCount(inventoryLocations)} note={`${averageLocations.toLocaleString("es-CO", { maximumFractionDigits: 1 })} bodegas por SKU visible`} icon={Layers3} loading={loadingInitial} />
        <KpiCard title="Marcas visibles" value={formatCount(visibleBrandCount)} note="Segun filtros actuales" icon={Tags} loading={loadingInitial} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_220px_220px_220px_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} disabled={loadingInitial} placeholder="Buscar SKU, producto, marca, categoria o bodega" className="h-10 pl-9" />
            </div>
            <SearchableSelect
              value={brand}
              onValueChange={setBrand}
              options={brandOptions}
              allLabel="Todas las marcas"
              searchPlaceholder="Buscar marca..."
              emptyLabel="No hay marcas"
              disabled={loadingInitial}
            />
            <SearchableSelect
              value={category}
              onValueChange={setCategory}
              options={categoryOptions}
              allLabel="Todas las categorias"
              searchPlaceholder="Buscar categoria..."
              emptyLabel="No hay categorias"
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
                <SelectItem value="available_desc">Ordenar por disponible mayor</SelectItem>
                <SelectItem value="available_asc">Ordenar por disponible menor</SelectItem>
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
              <PopoverContent align="end" className="max-h-[min(78svh,680px)] w-[calc(100vw-1.5rem)] overflow-y-auto p-0 sm:w-[min(94vw,880px)]">
                <div className="border-b p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">Filtros avanzados</p>
                      <p className="text-sm text-muted-foreground">Todos estos filtros consultan campos reales del catalogo e inventario agregado.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearFilters} disabled={loadingInitial} className="w-full gap-2 sm:w-auto">
                      <X className="h-4 w-4" /> Limpiar todo
                    </Button>
                  </div>
                </div>

                <div className="space-y-5 p-4">
                  <ProductFilterSection icon={Package} title="Catalogo">
                    <ProductFilterField label="SKU">
                      <Input value={sku} onChange={(event) => setSku(event.target.value)} disabled={loadingInitial} placeholder="Ej: 015Au" />
                    </ProductFilterField>
                    <ProductFilterField label="Linea">
                      <Select value={line} onValueChange={setLine} disabled={loadingInitial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todas las lineas</SelectItem>{lines.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </ProductFilterField>
                    <ProductFilterField label="Especie">
                      <Select value={species} onValueChange={setSpecies} disabled={loadingInitial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todas las especies</SelectItem>{speciesOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                    </ProductFilterField>
                    <ProductFilterField label="Verificacion">
                      <Select value={verification} onValueChange={setVerification} disabled={loadingInitial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="verified">Verificados</SelectItem>
                          <SelectItem value="unverified">Sin verificar</SelectItem>
                        </SelectContent>
                      </Select>
                    </ProductFilterField>
                  </ProductFilterSection>

                  <Separator />

                  <ProductFilterSection icon={Boxes} title="Inventario">
                    <ProductFilterField label="Estado de inventario">
                      <Select value={inventoryStatus} onValueChange={setInventoryStatus} disabled={loadingInitial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="in_stock">Con stock disponible</SelectItem>
                          <SelectItem value="with_inventory">Con bodegas</SelectItem>
                          <SelectItem value="without_inventory">Sin bodegas</SelectItem>
                        </SelectContent>
                      </Select>
                    </ProductFilterField>
                    <ProductRangeFilter label="Disponible agregado" min={minUnits} max={maxUnits} onMinChange={setMinUnits} onMaxChange={setMaxUnits} minPlaceholder="Min. unidades" maxPlaceholder="Max. unidades" />
                  </ProductFilterSection>

                  <Separator />

                  <ProductFilterSection icon={BadgeCheck} title="Estado">
                    <ProductFilterField label="Ciclo de vida">
                      <Select value={status} onValueChange={setStatus} disabled={loadingInitial}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="active">Activos</SelectItem>
                          <SelectItem value="discontinued">Descontinuados</SelectItem>
                        </SelectContent>
                      </Select>
                    </ProductFilterField>
                  </ProductFilterSection>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={inventoryStatus === "in_stock" ? "default" : "outline"} onClick={() => setInventoryStatus(inventoryStatus === "in_stock" ? "all" : "in_stock")} disabled={loadingInitial} className="h-8">Con stock</Button>
            <Button type="button" size="sm" variant={verification === "verified" ? "default" : "outline"} onClick={() => setVerification(verification === "verified" ? "all" : "verified")} disabled={loadingInitial} className="h-8">Verificados</Button>
            <Button type="button" size="sm" variant={status === "active" ? "default" : "outline"} onClick={() => setStatus(status === "active" ? "all" : "active")} disabled={loadingInitial} className="h-8">Activos</Button>
            <Button type="button" size="sm" variant={status === "discontinued" ? "default" : "outline"} onClick={() => setStatus(status === "discontinued" ? "all" : "discontinued")} disabled={loadingInitial} className="h-8">Descontinuados</Button>
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
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No hay productos para los filtros seleccionados</div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {products.map((product) => {
                  const statusInfo = productStatus(product);
                  return (
                    <div key={product.product_sku} className="rounded-md border bg-card p-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{text(product.product_commercial_name, "Producto sin nombre")}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">SKU: {product.product_sku}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        {product.product_category && <Badge variant="outline">{text(product.product_category)}</Badge>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div><p className="text-xs text-muted-foreground">Marca</p><p className="truncate font-medium">{text(product.product_brand_name)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Disponible</p><p className="font-semibold">{formatCount(numberValue(product.total_units_available ?? product.units_available_in_stock))}</p></div>
                        <div><p className="text-xs text-muted-foreground">Bodegas</p><p className="font-semibold">{formatCount(numberValue(product.inventory_locations_count))}</p></div>
                        <div><p className="text-xs text-muted-foreground">Pedido</p><p className="font-semibold">{formatCount(numberValue(product.ordered_quantity))}</p></div>
                      </div>
                      <Button variant="outline" className="mt-3 w-full gap-2" onClick={() => setSelected(product)} disabled={loadingInitial}>
                        <Eye className="h-4 w-4" /> Ver detalle
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead>Bodegas</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const statusInfo = productStatus(product);
                      return (
                        <TableRow key={product.product_sku}>
                          <TableCell className="max-w-[340px]">
                            <p className="truncate font-medium">{text(product.product_commercial_name, "Producto sin nombre")}</p>
                            <p className="truncate text-xs text-muted-foreground">SKU: {product.product_sku}</p>
                          </TableCell>
                          <TableCell>{text(product.product_brand_name)}</TableCell>
                          <TableCell>{text(product.product_category)}</TableCell>
                          <TableCell className="text-center font-mono">{formatCount(numberValue(product.total_units_available ?? product.units_available_in_stock))}</TableCell>
                          <TableCell className="text-center">{formatCount(numberValue(product.inventory_locations_count))}</TableCell>
                          <TableCell className="text-center"><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(product)} disabled={loadingInitial} title="Ver detalle">
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

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">
          {selected && (
            <>
              <div className="bg-background px-4 pb-4 pt-5 sm:px-6">
                <SheetHeader className="text-left">
                  <div className="pr-8">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {selectedStatus && <Badge variant={selectedStatus.variant}>{selectedStatus.label}</Badge>}
                        {selected.product_line_name && <Badge variant="outline">{text(selected.product_line_name)}</Badge>}
                        {selected.product_category && <Badge variant="secondary">{text(selected.product_category)}</Badge>}
                      </div>
                      <div className="min-w-0">
                        <SheetTitle className="truncate text-xl font-bold sm:text-2xl">{text(selected.product_commercial_name, "Producto sin nombre")}</SheetTitle>
                        <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-mono font-medium text-foreground">SKU {selected.product_sku}</span>
                          <span className="hidden text-muted-foreground sm:inline">/</span>
                          <span>{text(selected.product_brand_name, "Marca no registrada")}</span>
                        </SheetDescription>
                      </div>
                    </div>
                  </div>
                </SheetHeader>
              </div>

              <div className="space-y-5 px-4 py-4 sm:px-6">
                <ProductExternalMedia
                  catalogProduct={selected}
                  externalProduct={externalProduct}
                  imageUrl={externalImageUrl}
                  loading={externalProductLoading}
                  error={externalProductError}
                  imageLoadFailed={imageLoadFailed}
                  onImageError={() => setImageLoadFailed(true)}
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ProfileMetric label="Disponible" value={formatCount(numberValue(selected.total_units_available ?? selected.units_available_in_stock))} />
                  <ProfileMetric label="Bodegas" value={formatCount(numberValue(selected.inventory_locations_count))} />
                  <ProfileMetric label="Comprometido" value={formatCount(numberValue(selected.committed_quantity))} />
                  <ProfileMetric label="Listas precio" value={formatCount(numberValue(selected.price_lists_count ?? selectedPriceLists.length))} />
                </div>

                <Tabs defaultValue="summary">
                  <TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-muted/70 p-1">
                    <TabsTrigger value="summary" className="h-10">Resumen</TabsTrigger>
                    <TabsTrigger value="inventories" className="h-10">Inventarios</TabsTrigger>
                    <TabsTrigger value="prices" className="h-10">Precios SAP</TabsTrigger>
                    <TabsTrigger value="details" className="h-10">Datos adicionales</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-4 space-y-3 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <div className="grid items-stretch gap-3 lg:grid-cols-2">
                      <InfoPanel
                        icon={Package}
                        title="Descripcion"
                        rows={[
                          ["Descripcion tecnica", selected.product_technical_description],
                          ["Frecuencia recomendada", selected.product_recommended_application_frequency],
                          ["SKUs sustitutos", selected.product_substitute_skus],
                        ]}
                      />
                      <InfoPanel
                        icon={Tags}
                        title="Clasificacion"
                        rows={[
                          ["Marca", selected.product_brand_name],
                          ["Categoria", selected.product_category],
                          ["Linea", selected.product_line_name],
                          ["Especie", selected.product_target_species ?? selected.product_target_animal_species],
                          ["Sector", selected.product_industry_sector],
                          ["Unidad", selected.product_unit_of_measurement],
                        ]}
                      />
                    </div>
                    <div>
                      <InfoPanel icon={Boxes} title="Inventario agregado" rows={[
                        ["Disponible", selected.total_units_available ?? selected.units_available_in_stock],
                        ["Pedido", selected.ordered_quantity],
                        ["Comprometido", selected.committed_quantity],
                        ["Stock minimo", selected.minimal_stock],
                        ["Stock maximo", selected.maximal_stock],
                        ["Costo promedio", money(selected.avg_standard_average_price ?? selected.avg_unit_sale_price)],
                      ]} />
                    </div>
                  </TabsContent>

                  <TabsContent value="inventories" className="mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                    {selectedInventories.length === 0 ? (
                      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">Este producto no tiene inventarios registrados.</div>
                    ) : (
                      <div className="overflow-hidden rounded-md border">
                        <div className="grid grid-cols-[minmax(5.75rem,1fr)_4rem_4rem_4.75rem_4.5rem_5.75rem] bg-muted/60 px-2 py-2.5 text-xs font-semibold text-muted-foreground sm:px-3">
                          <span>Bodega</span>
                          <span className="text-right">Disp.</span>
                          <span className="text-right">Pedido</span>
                          <span className="text-right">Comprom.</span>
                          <span className="text-right">Min/Max</span>
                          <span className="text-right">Costo</span>
                        </div>
                        {selectedInventories.map((inventory, index) => (
                          <div key={`${inventory.inventory_id ?? index}`} className="grid grid-cols-[minmax(5.75rem,1fr)_4rem_4rem_4.75rem_4.5rem_5.75rem] items-center border-t px-2 py-2.5 text-sm sm:px-3">
                            <span className="min-w-0 truncate pr-2 font-mono text-xs" title={inventory.warehouse_code ?? "N/A"}>{inventory.warehouse_code ?? "N/A"}</span>
                            <span className="text-right font-semibold">{formatCount(numberValue(inventory.in_stock))}</span>
                            <span className="text-right">{formatCount(numberValue(inventory.ordered_quantity))}</span>
                            <span className="text-right">{formatCount(numberValue(inventory.committed_quantity))}</span>
                            <span className="text-right text-xs">{formatCount(numberValue(inventory.minimal_stock))} / {formatCount(numberValue(inventory.maximal_stock))}</span>
                            <span className="truncate text-right text-xs font-medium" title={money(inventory.standard_average_price)}>{money(inventory.standard_average_price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="prices" className="mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                    {selectedPriceLists.length === 0 || priceListColumns.length === 0 ? (
                      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">Este producto no tiene listas de precio SAP registradas.</div>
                    ) : (
                      <div className="overflow-hidden rounded-md border">
                        <div className="flex items-center justify-between gap-4 bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                          <span>Lista SAP</span>
                          <span>Precio SAP</span>
                        </div>
                        {selectedPriceLists.map((row, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between gap-4 border-t px-3 py-3 text-sm"
                          >
                            <span className="min-w-0 truncate font-medium" title={formatField(row.sap_price_list)}>
                              {formatField(row.sap_price_list)}
                            </span>
                            <span className="shrink-0 text-right font-mono font-semibold" title={formatField(row.sap_price)}>
                              {formatField(row.sap_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="mt-4 focus-visible:ring-0 focus-visible:ring-offset-0">
                    {additionalFields.length === 0 ? (
                      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">No hay campos adicionales con informacion para este producto.</div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {additionalFields.map(([key, value]) => (
                          <div key={key} className="rounded-md border bg-card p-3 shadow-sm">
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

function ProductFilterSection({
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

function ProductFilterField({
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

function ProductRangeFilter({
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

function ProductExternalMedia({
  catalogProduct,
  externalProduct,
  imageUrl,
  loading,
  error,
  imageLoadFailed,
  onImageError,
}: {
  catalogProduct: ProductCatalogItem;
  externalProduct: SupabaseProduct | null;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  imageLoadFailed: boolean;
  onImageError: () => void;
}) {
  const showImage = Boolean(imageUrl && !imageLoadFailed);
  const officialBrand = externalProduct?.product_brand_name || catalogProduct.product_brand_name;

  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div
          className={cn(
            "flex min-h-[9rem] w-full items-center justify-center overflow-hidden rounded-md border",
            showImage ? "bg-white" : "bg-muted/35",
          )}
        >
          {loading ? (
            <div className="h-full w-full animate-pulse bg-muted" />
          ) : showImage ? (
            <img
              src={imageUrl}
              alt={text(catalogProduct.product_commercial_name, "Producto")}
              className="h-full w-full object-contain p-2"
              onError={onImageError}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageOff className="h-9 w-9" />
              <span className="text-xs font-medium">Sin imagen</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {error ? (
            <div className="flex min-h-[9rem] items-center rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              No se pudo cargar el producto externo: {error}
            </div>
          ) : (
            <div className="grid h-full gap-2 text-sm sm:grid-cols-2">
              <ExternalProductFact label="Marca oficial" value={officialBrand} />
              <ExternalProductFact label="Categoria" value={externalProduct?.product_category} />
              <ExternalProductFact label="Presentacion" value={externalProduct?.product_presentation} />
              <ExternalProductFact label="Activo" value={externalProduct?.product_active_ingredient} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExternalProductFact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-h-[4rem] min-w-0 flex-col justify-center rounded-md bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium text-foreground">{text(value)}</p>
    </div>
  );
}

function ProductFact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-h-[4rem] rounded-md bg-muted/35 px-3 py-2">
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
            <ProductFact key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </div>
  );
}
