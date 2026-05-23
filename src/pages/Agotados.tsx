import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Agotado,
  AgotadoCreate,
  createAgotado,
  deleteAgotado,
  listAgotados,
  resolveAgotado,
  searchProductsLight,
  getAllRepresentatives,
  Representative,
  ProductLightItem,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PackageX, Search, CheckCircle2, Trash2, X, ArrowUp, BarChart2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { ErrorDisabledContent } from "@/components/common/ErrorDisabledContent";
import { PageHeader } from "@/components/common/PageHeader";
import { AgotadosDashboardModal } from "@/components/agotados/AgotadosDashboardModal";

const DISPLAY_PAGE = 50;

const REASONS = [
  "Sin stock en bodega",
  "Proveedor sin stock",
  "Producto descontinuado",
  "Producto en tránsito",
  "Otro",
];

// ── Sales Rep View ─────────────────────────────────────────────────────────────

function SalesRepView() {
  const queryClient = useQueryClient();

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<ProductLightItem[]>([]);
  const [reason, setReason] = useState("");
  const [otroDetalle, setOtroDetalle] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ reason?: string; otroDetalle?: string }>({});

  // Reports filters
  const [reportSearchInput, setReportSearchInput] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [filterReason, setFilterReason] = useState("all");
  const [filterStatus, setFilterStatus] = useState("activo");

  // Infinite display
  const [displayCount, setDisplayCount] = useState(DISPLAY_PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleProductSearchChange = useCallback((value: string) => {
    setProductSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value.trim()), 200);
  }, []);

  const clearProductSearch = () => {
    setProductSearch("");
    setDebouncedSearch("");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  };

  const {
    data: productsPage,
    isLoading: loadingProducts,
    isFetching: fetchingProducts,
    isError: productsError,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["products-agotados-light", debouncedSearch],
    queryFn: () => searchProductsLight(debouncedSearch),
    enabled: debouncedSearch.length >= 1,
    staleTime: 30_000,
  });

  const {
    data: myReports = [],
    isLoading: loadingReports,
    isError: reportsError,
    error: reportsErrorObj,
    refetch: refetchReports,
  } = useQuery<Agotado[]>({
    queryKey: ["agotados-mine", filterStatus],
    queryFn: () => listAgotados({ status: filterStatus === "all" ? undefined : filterStatus, limit: 1000 }).then((d) => d ?? []),
    refetchOnMount: "always",
    gcTime: 0,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAgotado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agotados-mine"] });
      toast({ title: "Reporte eliminado" });
    },
  });

  const products = productsPage?.data ?? [];
  const reportsErrorMessage = reportsErrorObj instanceof Error ? reportsErrorObj.message : "Error al cargar los reportes";
  const reasonOptions = useMemo(() => REASONS.map((r) => ({ value: r, label: r })), []);

  // Client-side filter on reports
  const filtered = useMemo(() => myReports.filter((r) => {
    if (reportSearch) {
      const q = reportSearch.toLowerCase();
      if (!r.product_name?.toLowerCase().includes(q) && !r.product_sku.toLowerCase().includes(q)) return false;
    }
    if (filterReason !== "all" && r.reason !== filterReason) return false;
    return true;
  }), [myReports, reportSearch, filterReason]);

  const displayed = filtered.slice(0, displayCount);
  const hasMoreDisplay = displayCount < filtered.length;

  useEffect(() => { setDisplayCount(DISPLAY_PAGE); }, [filtered]);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMoreDisplay) setDisplayCount((c) => c + DISPLAY_PAGE);
    }, { rootMargin: "240px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreDisplay]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const commitReportSearch = () => setReportSearch(reportSearchInput.trim());

  const clearReportFilters = () => {
    setReportSearchInput(""); setReportSearch("");
    setFilterReason("all"); setFilterStatus("activo");
  };

  const activeFilters = [
    reportSearch.trim() && { key: "search", label: `Búsqueda: ${reportSearch}`, clear: () => { setReportSearch(""); setReportSearchInput(""); } },
    filterReason !== "all" && { key: "reason", label: `Motivo: ${filterReason}`, clear: () => setFilterReason("all") },
    filterStatus !== "activo" && { key: "status", label: filterStatus === "all" ? "Todos" : "Resueltos", clear: () => setFilterStatus("activo") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const toggleSelect = (product: ProductLightItem) => {
    setSelected((prev) =>
      prev.some((p) => p.product_sku === product.product_sku)
        ? prev.filter((p) => p.product_sku !== product.product_sku)
        : [...prev, product]
    );
  };

  const handleSubmit = async () => {
    const errors: typeof formErrors = {};
    if (!reason) errors.reason = "Selecciona un motivo";
    if (reason === "Otro" && !otroDetalle.trim()) errors.otroDetalle = "Especifica el caso 'Otro'";
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      if (!selected.length) toast({ title: "Selecciona al menos un producto", description: "Busca y marca los productos agotados.", variant: "destructive" });
      return;
    }
    if (!selected.length) {
      toast({ title: "Selecciona al menos un producto", description: "Busca y marca los productos agotados.", variant: "destructive" });
      return;
    }
    setFormErrors({});
    setSubmitting(true);
    try {
      await Promise.all(
        selected.map((p) =>
          createAgotado({
            product_sku: p.product_sku,
            product_name: p.product_commercial_name ?? p.product_sku,
            reason,
            notes: reason === "Otro" ? otroDetalle.trim() : (notes || undefined),
          } as AgotadoCreate)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["agotados-mine"] });
      toast({
        title: `${selected.length} agotado(s) reportado(s)`,
        description: "Los reportes fueron enviados correctamente.",
      });
      setSelected([]);
      setReason("");
      setOtroDetalle("");
      setNotes("");
      clearProductSearch();
    } catch {
      toast({ title: "Error al reportar", description: "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={reportsError}>
        <PageHeader
          icon={PackageX}
          title="Reportar Agotados"
          description="Busca productos y reporta cuáles están agotados en tu zona."
        />
      </ErrorDisabledContent>

      {reportsError && (
        <ModuleErrorCard
          message={reportsErrorMessage}
          onRetry={() => void refetchReports()}
          loading={loadingReports}
        />
      )}

      <ErrorDisabledContent disabled={reportsError} className="space-y-5 sm:space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Product search */}
          <div className="lg:col-span-2 space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Buscar Productos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar por nombre o SKU"
                    className="pl-9 pr-16"
                    value={productSearch}
                    onChange={(e) => handleProductSearchChange(e.target.value)}
                    disabled={submitting}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    {fetchingProducts && (
                      <Loader2 className="size-3.5 text-muted-foreground animate-spin" />
                    )}
                    {productSearch && (
                      <button
                        type="button"
                        onClick={clearProductSearch}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                {productSearch.length >= 1 && (
                  <div className="rounded-md border overflow-hidden">
                    {loadingProducts || (fetchingProducts && products.length === 0) ? (
                      <div className="space-y-2 p-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                        ))}
                      </div>
                    ) : productsError ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                        <PackageX className="size-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Error al buscar productos</p>
                        <button type="button" onClick={() => void refetchProducts()} className="text-xs text-primary underline">
                          Reintentar
                        </button>
                      </div>
                    ) : debouncedSearch.length < 1 ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Buscando…
                      </div>
                    ) : products.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Search className="size-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No se encontraron productos</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>SKU</TableHead>
                            <TableHead>Nombre</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((p) => {
                            const isChecked = selected.some((s) => s.product_sku === p.product_sku);
                            return (
                              <TableRow key={p.product_sku} className="cursor-pointer" onClick={() => toggleSelect(p)}>
                                <TableCell>
                                  <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(p)} onClick={(e) => e.stopPropagation()} />
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.product_sku}</TableCell>
                                <TableCell className="text-sm">{p.product_commercial_name ?? "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {productSearch.length < 1 && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Search className="size-4 shrink-0 text-primary" />
                    <span>Escribe el nombre o SKU para buscar un producto</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Report panel */}
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Reportar seleccionados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Selecciona productos de la lista</p>
                ) : (
                  <div className="rounded-md border divide-y">
                    {selected.map((p) => (
                      <div key={p.product_sku} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.product_commercial_name ?? p.product_sku}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.product_sku}</p>
                        </div>
                        <button
                          onClick={() => toggleSelect(p)}
                          className="ml-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          disabled={submitting}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className={formErrors.reason ? "text-destructive" : ""}>Motivo <span className="text-destructive">*</span></Label>
                  <Select
                    value={reason}
                    onValueChange={(v) => { setReason(v); setFormErrors((e) => ({ ...e, reason: undefined })); if (v !== "Otro") setOtroDetalle(""); }}
                    disabled={submitting}
                  >
                    <SelectTrigger className={formErrors.reason ? "border-destructive" : ""}>
                      <SelectValue placeholder="Selecciona motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formErrors.reason && <p className="text-xs text-destructive">{formErrors.reason}</p>}
                </div>

                {reason === "Otro" && (
                  <div className="space-y-1.5">
                    <Label className={formErrors.otroDetalle ? "text-destructive" : ""}>
                      Especifica el caso <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Describe el motivo..."
                      value={otroDetalle}
                      onChange={(e) => { setOtroDetalle(e.target.value); setFormErrors((er) => ({ ...er, otroDetalle: undefined })); }}
                      disabled={submitting}
                      className={formErrors.otroDetalle ? "border-destructive focus-visible:ring-destructive/30" : ""}
                    />
                    {formErrors.otroDetalle && <p className="text-xs text-destructive">{formErrors.otroDetalle}</p>}
                  </div>
                )}

                {reason !== "Otro" && (
                  <div className="space-y-1.5">
                    <Label>Notas <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                    <Textarea placeholder="Información adicional..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={submitting} />
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting || !selected.length}
                >
                  {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <PackageX className="size-4 mr-2" />}
                  Enviar Reporte {selected.length > 0 ? `(${selected.length})` : ""}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* My reports */}
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 p-4 sm:p-6 pb-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px_160px]">
              {/* Search */}
              <div className="relative min-w-0">
                <button
                  type="button"
                  onClick={commitReportSearch}
                  disabled={loadingReports}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  <Search className="size-4" />
                </button>
                <Input
                  value={reportSearchInput}
                  onChange={(e) => setReportSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitReportSearch()}
                  disabled={loadingReports}
                  placeholder="Buscar por producto o SKU"
                  className="h-10 pl-9 pr-9"
                />
                {reportSearch && (
                  <button
                    type="button"
                    onClick={() => { setReportSearchInput(""); setReportSearch(""); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <SearchableSelect
                value={filterReason}
                onValueChange={setFilterReason}
                options={reasonOptions}
                allLabel="Todos los motivos"
                searchPlaceholder="Buscar motivo…"
                emptyLabel="No hay motivos"
                disabled={loadingReports}
              />
              <Select value={filterStatus} onValueChange={setFilterStatus} disabled={loadingReports}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={f.clear}
                    disabled={loadingReports}
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
                  >
                    <span className="truncate">{f.label}</span>
                    <X className="size-3 shrink-0" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearReportFilters}
                  disabled={loadingReports}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" /> Limpiar
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            {loadingReports ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PackageX className="size-12 text-muted-foreground/30 mb-4" />
                <p className="font-medium text-muted-foreground">
                  {activeFilters.length > 0 ? "No hay reportes con los filtros seleccionados" : "No se pudieron encontraron reportes"}
                </p>
                {activeFilters.length > 0 && (
                  <Button variant="outline" className="mt-4 gap-2" onClick={clearReportFilters}>
                    <X className="size-4" /> Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Reportado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayed.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.product_sku}</TableCell>
                          <TableCell className="text-sm">{r.product_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{r.reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(r.reported_at).toLocaleDateString("es-CO")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.status === "activo" ? "destructive" : "secondary"}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.status === "activo" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(r.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div ref={sentinelRef} className="h-px" aria-hidden="true" />
                {hasMoreDisplay && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Cargando más reportes…</span>
                  </div>
                )}
                {!hasMoreDisplay && filtered.length > DISPLAY_PAGE && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {filtered.length} reportes en total
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </ErrorDisabledContent>

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          aria-label="Volver al inicio"
        >
          <ArrowUp className="size-5" />
        </button>
      )}
    </div>
  );
}

// ── Superadmin View ────────────────────────────────────────────────────────────

function SuperadminView() {
  const queryClient = useQueryClient();

  const [dashOpen, setDashOpen] = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterRep, setFilterRep] = useState("all");
  const [filterReason, setFilterReason] = useState("all");

  // Display pagination (client-side infinite scroll over fetched data)
  const [displayCount, setDisplayCount] = useState(DISPLAY_PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Scroll-to-top
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { data: reports = [], isLoading, isError, error, refetch } = useQuery<Agotado[]>({
    queryKey: ["agotados-all", filterStatus],
    queryFn: () => listAgotados({ status: filterStatus === "all" ? undefined : filterStatus, limit: 1000 }).then((d) => d ?? []),
    refetchOnMount: "always",
    gcTime: 0,
    retry: false,
  });

  const { data: representatives = [] } = useQuery<Representative[]>({
    queryKey: ["representatives-all"],
    queryFn: getAllRepresentatives,
    gcTime: 0,
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAgotado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agotados-all"] });
      toast({ title: "Marcado como resuelto" });
    },
  });

  const repOptions = useMemo(
    () => representatives.map((r) => ({ value: r.sales_rep_full_name, label: r.sales_rep_full_name })),
    [representatives],
  );
  const reasonOptions = useMemo(() => REASONS.map((r) => ({ value: r, label: r })), []);

  // Client-side filtering
  const filtered = useMemo(() => reports.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.product_name?.toLowerCase().includes(q) && !r.product_sku.toLowerCase().includes(q)) return false;
    }
    if (filterRep !== "all" && r.sales_rep_name !== filterRep) return false;
    if (filterReason !== "all" && r.reason !== filterReason) return false;
    return true;
  }), [reports, search, filterRep, filterReason]);

  const displayed = filtered.slice(0, displayCount);
  const hasMoreDisplay = displayCount < filtered.length;

  // Reset display count when filters change
  useEffect(() => { setDisplayCount(DISPLAY_PAGE); }, [filtered]);

  // IntersectionObserver for infinite display
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMoreDisplay) setDisplayCount((c) => c + DISPLAY_PAGE);
    }, { rootMargin: "240px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreDisplay]);

  // Scroll-to-top visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const commitSearch = () => setSearch(searchInput.trim());

  const clearAllFilters = () => {
    setSearchInput(""); setSearch("");
    setFilterRep("all"); setFilterReason("all");
    setFilterStatus("all");
  };

  const activeFilters = [
    search.trim() && { key: "search", label: `Búsqueda: ${search}`, clear: () => { setSearch(""); setSearchInput(""); } },
    filterRep !== "all" && { key: "rep", label: `Rep: ${filterRep}`, clear: () => setFilterRep("all") },
    filterReason !== "all" && { key: "reason", label: `Motivo: ${filterReason}`, clear: () => setFilterReason("all") },
    filterStatus !== "all" && { key: "status", label: filterStatus === "activo" ? "Activos" : "Resueltos", clear: () => setFilterStatus("all") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const activos = reports.filter((r) => r.status === "activo").length;
  const totalReps = new Set(reports.map((r) => r.sales_rep_name)).size;
  const errorMessage = error instanceof Error ? error.message : "Error al cargar los reportes";

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={isError}>
        <PageHeader
          icon={PackageX}
          title="Dashboard Agotados"
          description="Reportes de productos agotados de los representantes de venta."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDashOpen(true)}
              disabled={isLoading || reports.length === 0}
              className="gap-2"
            >
              <BarChart2 className="size-4" />
              Ver Dashboard
            </Button>
          }
        />
      </ErrorDisabledContent>

      {isError && (
        <ModuleErrorCard
          message={errorMessage}
          onRetry={() => void refetch()}
          loading={isLoading}
        />
      )}

      <ErrorDisabledContent disabled={isError} className="space-y-5 sm:space-y-6">
        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Activos", value: activos, className: "text-destructive" },
            { label: "Total reportes", value: reports.length, className: "" },
            { label: "Representantes", value: totalReps, className: "" },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                {isLoading ? (
                  <div className="mt-1 h-7 w-24 animate-pulse rounded bg-muted" />
                ) : (
                  <p className={`text-3xl font-bold ${metric.className}`}>{metric.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 p-4 sm:p-6 pb-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px_200px_160px]">
              {/* Search */}
              <div className="relative min-w-0">
                <button
                  type="button"
                  onClick={commitSearch}
                  disabled={isLoading}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  <Search className="size-4" />
                </button>
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitSearch()}
                  disabled={isLoading}
                  placeholder="Buscar por producto o SKU"
                  className="h-10 pl-9 pr-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(""); setSearch(""); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <SearchableSelect
                value={filterRep}
                onValueChange={setFilterRep}
                options={repOptions}
                allLabel="Todos los representantes"
                searchPlaceholder="Buscar representante…"
                emptyLabel="No hay representantes"
                disabled={isLoading}
              />
              <SearchableSelect
                value={filterReason}
                onValueChange={setFilterReason}
                options={reasonOptions}
                allLabel="Todos los motivos"
                searchPlaceholder="Buscar motivo…"
                emptyLabel="No hay motivos"
                disabled={isLoading}
              />
              <Select value={filterStatus} onValueChange={setFilterStatus} disabled={isLoading}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="resuelto">Resueltos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={f.clear}
                    disabled={isLoading}
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15"
                  >
                    <span className="truncate">{f.label}</span>
                    <X className="size-3 shrink-0" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  disabled={isLoading}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" /> Limpiar
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <PackageX className="size-12 text-muted-foreground/30 mb-4" />
                <p className="font-medium text-muted-foreground">
                  {activeFilters.length > 0 ? "No hay reportes con los filtros seleccionados" : "No se pudieron encontraron reportes"}
                </p>
                {activeFilters.length > 0 && (
                  <Button variant="outline" className="mt-4 gap-2" onClick={clearAllFilters}>
                    <X className="size-4" /> Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Rep. de Venta</TableHead>
                        <TableHead>Reportado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayed.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.product_sku}</TableCell>
                          <TableCell className="text-sm">{r.product_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{r.reason}</TableCell>
                          <TableCell className="text-sm">{r.sales_rep_name ?? `#${r.sales_rep_id}`}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(r.reported_at).toLocaleDateString("es-CO")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.status === "activo" ? "destructive" : "secondary"}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.status === "activo" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => resolveMutation.mutate(r.id)}
                                disabled={resolveMutation.isPending}
                              >
                                <CheckCircle2 className="size-3.5" />
                                Resolver
                              </Button>
                            ) : (
                              <CheckCircle2 className="size-4 text-green-600 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Sentinel for infinite scroll */}
                <div ref={sentinelRef} className="h-px" aria-hidden="true" />
                {hasMoreDisplay && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Cargando más reportes…</span>
                  </div>
                )}

                {/* Count indicator */}
                {!hasMoreDisplay && filtered.length > DISPLAY_PAGE && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {filtered.length} reportes en total
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </ErrorDisabledContent>

      <AgotadosDashboardModal
        open={dashOpen}
        onOpenChange={setDashOpen}
        reports={reports}
      />

      {/* Scroll-to-top FAB */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          aria-label="Volver al inicio"
        >
          <ArrowUp className="size-5" />
        </button>
      )}
    </div>
  );
}

// ── Page entry point ───────────────────────────────────────────────────────────

export default function Agotados() {
  const { user } = useAuth();
  const isSalesRep = user?.role === "sales_rep";
  return isSalesRep ? <SalesRepView /> : <SuperadminView />;
}
