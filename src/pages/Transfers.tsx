import { useState, useEffect, useRef, useMemo } from "react";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  PromotorTransfer,
  listTransfers,
  submitTransfer,
  cancelTransfer,
  getAllRepresentatives,
  Representative,
} from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  ArrowRightLeft,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  Loader2,
  Package,
  Search,
  SendHorizonal,
  SlidersHorizontal,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { buildExportFileName, exportRowsToWorkbook } from "@/lib/export";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { ErrorDisabledContent } from "@/components/common/ErrorDisabledContent";
import { PageHeader } from "@/components/common/PageHeader";

const DISPLAY_PAGE = 50;

type TransferStatus = "all" | "borrador" | "enviada" | "cancelada";

function statusLabel(status: PromotorTransfer["status"]): string {
  return { borrador: "Borrador", enviada: "Enviada", cancelada: "Cancelada" }[status] ?? status;
}

function StatusBadge({ status }: { status: PromotorTransfer["status"] }) {
  return (
    <Badge
      variant={
        status === "enviada"
          ? "default"
          : status === "borrador"
            ? "outline"
            : "destructive"
      }
      className={cn(status === "enviada" && "bg-primary text-primary-foreground")}
    >
      {statusLabel(status)}
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── FilterSection + FilterField (same pattern as Customers) ───────────────────
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
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
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

// ── Transfer Detail Sheet ──────────────────────────────────────────────────────
function TransferDetailSheet({
  transfer,
  onClose,
  isSuperadmin,
  onSubmit,
  onCancel,
  isMutating,
}: {
  transfer: PromotorTransfer | null;
  onClose: () => void;
  isSuperadmin: boolean;
  onSubmit?: (id: string) => void;
  onCancel?: (id: string) => void;
  isMutating?: boolean;
}) {
  return (
    <Sheet open={!!transfer} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        {transfer && (
          <>
            {/* Header */}
            <div className="bg-background/95 px-4 pb-4 pt-5 sm:px-6">
              <SheetHeader className="text-left">
                <div className="pr-8">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={transfer.status} />
                    </div>
                    <div>
                      <SheetTitle className="font-mono text-xl font-bold sm:text-2xl">
                        {transfer.reference}
                      </SheetTitle>
                      <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span>{formatDate(transfer.created_at)}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </div>
              </SheetHeader>
            </div>

            {/* Body */}
            <div className="space-y-5 px-4 py-4 sm:px-6">
              {/* Info panels */}
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Promotor */}
                <section className="rounded-md border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <UserRound className="size-4 text-primary" />
                    <h3 className="font-semibold">Promotor</h3>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nombre</p>
                      <p className="text-sm font-medium">{transfer.promotor_name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Identificador</p>
                      <p className="font-mono text-sm">{transfer.promotor_id}</p>
                    </div>
                  </div>
                </section>

                {/* Representante */}
                <section className="rounded-md border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <UserRound className="size-4 text-primary" />
                    <h3 className="font-semibold">Representante de Venta</h3>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nombre</p>
                      <p className="text-sm font-medium">{transfer.sales_representative_name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Identificador</p>
                      <p className="font-mono text-sm">{transfer.sales_representative_id}</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Cliente */}
              {(transfer.customer_name || transfer.customer_id) && (
                <section className="rounded-md border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <UserRound className="size-4 text-primary" />
                    <h3 className="font-semibold">Cliente</h3>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nombre</p>
                      <p className="text-sm font-medium">{transfer.customer_name ?? "—"}</p>
                    </div>
                    {transfer.customer_id && (
                      <div>
                        <p className="text-xs text-muted-foreground">Identificador</p>
                        <p className="font-mono text-sm">{transfer.customer_id}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Items */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  <h3 className="font-semibold">Items ({transfer.items.length})</h3>
                </div>
                {transfer.items.length === 0 ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                    Esta transferencia no tiene items registrados.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border bg-card">
                    <div className="hidden grid-cols-[3rem_minmax(0,1fr)_8rem_1rem] bg-muted/60 px-3 py-2.5 text-xs font-semibold text-muted-foreground sm:grid">
                      <span>item</span>
                      <span>Producto</span>

                      <span className="text-right">Cantidad</span>
                    </div>
                    {transfer.items.map((item, index) => (
                      <div
                        key={item.id ?? index}
                        className="grid gap-2 border-t px-3 py-3 text-sm sm:grid-cols-[3rem_minmax(0,1fr)_8rem_1rem] sm:items-center sm:gap-0"
                      >
                        <span className="flex size-6 items-center justify-center rounded bg-primary/10 font-mono text-xs font-bold text-primary">
                          {item.line_number}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.product_name ?? "Sin nombre"}</p>
                          <Badge variant="outline" className="w-fit font-mono text-[10px]">
                            SKU: {item.product_sku}
                          </Badge>
                        </div>
                        <p className="font-semibold sm:text-right"><span className="sm:hidden inline">Cant: </span>{item.quantity}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Observaciones */}
              {transfer.observations && (
                <section className="rounded-md border bg-muted/40 p-4">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observaciones</p>
                  <p className="text-sm">{transfer.observations}</p>
                </section>
              )}

              {/* Actions (superadmin + borrador only) */}
              {isSuperadmin && transfer.status === "borrador" && onSubmit && onCancel && (
                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
                  <Button
                    className="gap-2 sm:flex-1"
                    onClick={() => onSubmit(transfer.id)}
                    disabled={isMutating}
                  >
                    <SendHorizonal className="size-4" />
                    Enviar transferencia
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive sm:flex-1"
                    onClick={() => onCancel(transfer.id)}
                    disabled={isMutating}
                  >
                    <XCircle className="size-4" />
                    Cancelar transferencia
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Sales Rep View ─────────────────────────────────────────────────────────────

function SalesRepView() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<TransferStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterPromotor, setFilterPromotor] = useState("all");
  const [displayCount, setDisplayCount] = useState(DISPLAY_PAGE);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<PromotorTransfer | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "submit" | "cancel"; id: string; reference: string } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: transfers = [], isLoading, isError, error, refetch } = useQuery<PromotorTransfer[]>({
    queryKey: ["transfers-mine", filterStatus],
    queryFn: () => listTransfers({ status: filterStatus === "all" ? undefined : filterStatus, limit: 1000 }),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    gcTime: 0,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: submitTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers-mine"] });
      toast({ title: "Transferencia enviada" });
    },
    onError: (e) => {
      toast({ title: "Error al enviar", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers-mine"] });
      toast({ title: "Transferencia cancelada" });
    },
    onError: (e) => {
      toast({ title: "Error al cancelar", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    },
  });

  const isMutating = submitMutation.isPending || cancelMutation.isPending;

  const promotorOptions = useMemo(() => {
    const names = Array.from(new Set(
      transfers.map((t) => t.promotor_name).filter((n): n is string => !!n)
    )).sort((a, b) => a.localeCompare(b, "es-CO"));
    return names.map((n) => ({ value: n, label: n }));
  }, [transfers]);

  const filtered = useMemo(() => transfers.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        t.reference.toLowerCase().includes(q) ||
        (t.promotor_name ?? "").toLowerCase().includes(q) ||
        (t.customer_name ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterPromotor !== "all" && t.promotor_name !== filterPromotor) return false;
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.created_at) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  }), [transfers, search, filterPromotor, dateFrom, dateTo]);

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

  const commitSearch = () => setSearch(searchInput.trim());

  const advancedFilterCount = [dateFrom, dateTo, filterPromotor !== "all" ? filterPromotor : ""].filter(Boolean).length;

  const clearAdvancedFilters = () => { setDateFrom(""); setDateTo(""); setFilterPromotor("all"); };

  const clearAllFilters = () => {
    setSearchInput(""); setSearch("");
    setFilterStatus("all");
    clearAdvancedFilters();
  };

  const activeFilters = [
    search.trim() && { key: "search", label: `Búsqueda: ${search}`, clear: () => { setSearch(""); setSearchInput(""); } },
    filterStatus !== "all" && { key: "status", label: `Estado: ${statusLabel(filterStatus as PromotorTransfer["status"])}`, clear: () => setFilterStatus("all") },
    filterPromotor !== "all" && { key: "promotor", label: `Promotor: ${filterPromotor}`, clear: () => setFilterPromotor("all") },
    dateFrom && { key: "dateFrom", label: `Desde: ${dateFrom}`, clear: () => setDateFrom("") },
    dateTo && { key: "dateTo", label: `Hasta: ${dateTo}`, clear: () => setDateTo("") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const errorMessage = error instanceof Error ? error.message : "Error al cargar las transferencias";

  const exportData = () => {
    setExporting(true);
    try {
      exportRowsToWorkbook(
        transfers,
        [
          { header: "Referencia", value: (t) => t.reference },
          { header: "Promotor", value: (t) => t.promotor_name ?? "" },
          { header: "Cliente", value: (t) => t.customer_name ?? "" },
          { header: "Cant. items", value: (t) => t.items.length },
          { header: "Productos", value: (t) => t.items.map((i) => `${i.product_sku} x${i.quantity}`).join(" | ") },
          { header: "Fecha", value: (t) => t.created_at },
          { header: "Estado", value: (t) => statusLabel(t.status) },
          { header: "Observaciones", value: (t) => t.observations ?? "" },
        ],
        buildExportFileName("mis-transferencias"),
        "Mis Transferencias",
      );
      toast({ title: `Se exportaron ${transfers.length} transferencias` });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={isError}>
        <PageHeader
          icon={ArrowRightLeft}
          title="Mis Transferencias"
          description="Transferencias de promotores asignadas a ti."
          actions={
            <Button
              onClick={exportData}
              disabled={isLoading || exporting || transfers.length === 0}
              className="w-full gap-2 md:w-auto"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? "Exportando…" : "Exportar"}
            </Button>
          }
        />
      </ErrorDisabledContent>

      {isError && (
        <ModuleErrorCard message={errorMessage} onRetry={() => void refetch()} loading={isLoading} />
      )}

      <ErrorDisabledContent disabled={isError} className="space-y-5 sm:space-y-6">
        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Borrador", value: transfers.filter((t) => t.status === "borrador").length, className: "text-amber-600 dark:text-amber-400", icon: ClipboardList, iconClass: "text-amber-600 dark:text-amber-400" },
            { label: "Enviadas", value: transfers.filter((t) => t.status === "enviada").length, className: "", icon: CheckCircle2, iconClass: "text-primary" },
            { label: "Total", value: transfers.length, className: "", icon: BarChart2, iconClass: "text-primary" },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <metric.icon className={`size-4 shrink-0 ${metric.iconClass}`} />
                </div>
                {isLoading ? (
                  <div className="mt-1 h-7 w-24 animate-pulse rounded bg-muted" />
                ) : (
                  <p className={`mt-1 text-3xl font-bold ${metric.className}`}>{metric.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 p-4 pb-3 sm:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
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
                  placeholder="Buscar por referencia, promotor o cliente"
                  className="h-10 pl-9 pr-9 text-sm"
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
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TransferStatus)} disabled={isLoading}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              {/* Advanced filters popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={advancedFilterCount > 0 ? "default" : "outline"}
                    className="h-10 gap-2"
                    disabled={isLoading}
                  >
                    <SlidersHorizontal className="size-4" />
                    Filtros
                    {advancedFilterCount > 0 && (
                      <span className="rounded bg-background/20 px-1.5 text-xs">{advancedFilterCount}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="max-h-[min(78svh,560px)] w-[calc(100vw-1.5rem)] overflow-y-auto p-0 sm:w-[min(94vw,600px)]">
                  <div className="border-b p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">Filtros avanzados</p>
                        <p className="text-sm text-muted-foreground">Filtra tus transferencias por promotor y rango de fechas.</p>
                      </div>
                      {advancedFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="w-full gap-2 sm:w-auto">
                          <X className="size-4" /> Limpiar todo
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-5 p-4">
                    <FilterSection icon={UserRound} title="Promotor">
                      <FilterField label="Promotor">
                        <SearchableSelect
                          value={filterPromotor}
                          onValueChange={setFilterPromotor}
                          options={promotorOptions}
                          allLabel="Todos los promotores"
                          searchPlaceholder="Buscar promotor…"
                          emptyLabel="No hay promotores"
                          disabled={isLoading}
                        />
                      </FilterField>
                    </FilterSection>
                    <Separator />
                    <FilterSection icon={CalendarDays} title="Fechas">
                      <FilterField label="Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm" />
                      </FilterField>
                      <FilterField label="Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm" />
                      </FilterField>
                    </FilterSection>
                  </div>
                </PopoverContent>
              </Popover>
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
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ArrowRightLeft className="mb-4 size-12 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">
                  {activeFilters.length > 0 ? "No hay transferencias con los filtros seleccionados" : "No tienes transferencias asignadas"}
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
                        <TableHead>Referencia</TableHead>
                        <TableHead className="hidden sm:table-cell">Promotor</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden md:table-cell">Items</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayed.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">
                            <p className="font-mono font-medium leading-snug">{t.reference}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{t.promotor_name ?? "—"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{formatDate(t.created_at)}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{t.promotor_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{t.customer_name ?? "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{t.items.length}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                          <TableCell><StatusBadge status={t.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              {t.status === "borrador" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-primary hover:text-primary"
                                    title="Enviar"
                                    onClick={() => setConfirmAction({ type: "submit", id: t.id, reference: t.reference })}
                                    disabled={isMutating}
                                  >
                                    <SendHorizonal className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive hover:text-destructive"
                                    title="Cancelar"
                                    onClick={() => setConfirmAction({ type: "cancel", id: t.id, reference: t.reference })}
                                    disabled={isMutating}
                                  >
                                    <XCircle className="size-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                title="Ver detalle"
                                onClick={() => setSelected(t)}
                              >
                                <Eye className="size-4" />
                              </Button>
                            </div>
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
                    <span>Cargando más transferencias…</span>
                  </div>
                )}
                {!hasMoreDisplay && filtered.length > DISPLAY_PAGE && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {filtered.length} transferencias en total
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </ErrorDisabledContent>

      <TransferDetailSheet
        transfer={selected}
        onClose={() => setSelected(null)}
        isSuperadmin={false}
        onSubmit={(id) => setConfirmAction({ type: "submit", id, reference: selected?.reference ?? id })}
        onCancel={(id) => setConfirmAction({ type: "cancel", id, reference: selected?.reference ?? id })}
        isMutating={isMutating}
      />

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "submit" ? "¿Enviar transferencia?" : "¿Cancelar transferencia?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "submit"
                ? <>Se enviará la transferencia <span className="font-mono font-semibold">{confirmAction.reference}</span>. Esta acción no se puede deshacer.</>
                : <>Se cancelará la transferencia <span className="font-mono font-semibold">{confirmAction?.reference}</span>. Esta acción no se puede deshacer.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === "cancel" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "submit") submitMutation.mutate(confirmAction.id);
                else cancelMutation.mutate(confirmAction.id);
                setConfirmAction(null);
                setSelected(null);
              }}
            >
              {confirmAction?.type === "submit" ? "Enviar" : "Cancelar transferencia"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Superadmin View ────────────────────────────────────────────────────────────

function SuperadminView() {
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<TransferStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterRep, setFilterRep] = useState("all");
  const [filterPromotor, setFilterPromotor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [displayCount, setDisplayCount] = useState(DISPLAY_PAGE);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<PromotorTransfer | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "submit" | "cancel"; id: string; reference: string } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: transfers = [], isLoading, isError, error, refetch } = useQuery<PromotorTransfer[]>({
    queryKey: ["transfers-all", filterStatus],
    queryFn: () => listTransfers({ status: filterStatus === "all" ? undefined : filterStatus, limit: 1000 }),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    gcTime: 0,
    retry: false,
  });

  const { data: representatives = [] } = useQuery<Representative[]>({
    queryKey: ["representatives-all"],
    queryFn: getAllRepresentatives,
    gcTime: 0,
  });

  const submitMutation = useMutation({
    mutationFn: submitTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers-all"] });
      toast({ title: "Transferencia enviada" });
    },
    onError: (e) => {
      toast({ title: "Error al enviar", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers-all"] });
      toast({ title: "Transferencia cancelada" });
    },
    onError: (e) => {
      toast({ title: "Error al cancelar", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    },
  });

  const repOptions = useMemo(
    () => {
      const names = Array.from(new Set(
        transfers.map((t) => t.sales_representative_name).filter((n): n is string => !!n)
      )).sort((a, b) => a.localeCompare(b, "es-CO"));
      return names.map((n) => ({ value: n, label: n }));
    },
    [transfers],
  );

  const promotorOptions = useMemo(() => {
    const names = Array.from(new Set(
      transfers.map((t) => t.promotor_name).filter((n): n is string => !!n)
    )).sort((a, b) => a.localeCompare(b, "es-CO"));
    return names.map((n) => ({ value: n, label: n }));
  }, [transfers]);

  const filtered = useMemo(() => transfers.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        t.reference.toLowerCase().includes(q) ||
        (t.promotor_name ?? "").toLowerCase().includes(q) ||
        (t.customer_name ?? "").toLowerCase().includes(q) ||
        (t.sales_representative_name ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterRep !== "all" && t.sales_representative_name !== filterRep) return false;
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(t.created_at) > new Date(dateTo + "T23:59:59")) return false;
    if (filterPromotor && !(t.promotor_name ?? "").toLowerCase().includes(filterPromotor.toLowerCase())) return false;
    return true;
  }), [transfers, search, filterRep, dateFrom, dateTo, filterPromotor]);

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

  const commitSearch = () => setSearch(searchInput.trim());

  const advancedFilterCount = [dateFrom, dateTo, filterPromotor].filter(Boolean).length;

  const clearAdvancedFilters = () => { setDateFrom(""); setDateTo(""); setFilterPromotor(""); };

  const clearAllFilters = () => {
    setSearchInput(""); setSearch("");
    setFilterRep("all"); setFilterStatus("all");
    clearAdvancedFilters();
  };

  const activeFilters = [
    search.trim() && { key: "search", label: `Búsqueda: ${search}`, clear: () => { setSearch(""); setSearchInput(""); } },
    filterRep !== "all" && { key: "rep", label: `Rep: ${filterRep}`, clear: () => setFilterRep("all") },
    filterStatus !== "all" && { key: "status", label: `Estado: ${statusLabel(filterStatus as PromotorTransfer["status"])}`, clear: () => setFilterStatus("all") },
    dateFrom && { key: "dateFrom", label: `Desde: ${dateFrom}`, clear: () => setDateFrom("") },
    dateTo && { key: "dateTo", label: `Hasta: ${dateTo}`, clear: () => setDateTo("") },
    filterPromotor && { key: "promotor", label: `Promotor: ${filterPromotor}`, clear: () => setFilterPromotor("") },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const borrador = transfers.filter((t) => t.status === "borrador").length;
  const enviadas = transfers.filter((t) => t.status === "enviada").length;
  const errorMessage = error instanceof Error ? error.message : "Error al cargar las transferencias";

  const isMutating = submitMutation.isPending || cancelMutation.isPending;

  const exportData = () => {
    setExporting(true);
    try {
      exportRowsToWorkbook(
        transfers,
        [
          { header: "Referencia", value: (t) => t.reference },
          { header: "Promotor", value: (t) => t.promotor_name ?? "" },
          { header: "Rep. de Venta", value: (t) => t.sales_representative_name ?? "" },
          { header: "Cliente", value: (t) => t.customer_name ?? "" },
          { header: "Cant. items", value: (t) => t.items.length },
          { header: "Productos", value: (t) => t.items.map((i) => `${i.product_sku} x${i.quantity}`).join(" | ") },
          { header: "Fecha", value: (t) => t.created_at },
          { header: "Estado", value: (t) => statusLabel(t.status) },
          { header: "Observaciones", value: (t) => t.observations ?? "" },
        ],
        buildExportFileName("transferencias"),
        "Transferencias",
      );
      toast({ title: `Se exportaron ${transfers.length} transferencias` });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={isError}>
        <PageHeader
          icon={ArrowRightLeft}
          title="Transferencias de Promotores"
          description="Gestiona las transferencias creadas por los promotores."
          actions={
            <Button
              onClick={exportData}
              disabled={isLoading || exporting || transfers.length === 0}
              className="w-full gap-2 md:w-auto"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? "Exportando…" : "Exportar"}
            </Button>
          }
        />
      </ErrorDisabledContent>

      {isError && (
        <ModuleErrorCard message={errorMessage} onRetry={() => void refetch()} loading={isLoading} />
      )}

      <ErrorDisabledContent disabled={isError} className="space-y-5 sm:space-y-6">
        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Borrador", value: borrador, className: "text-amber-600 dark:text-amber-400", icon: ClipboardList, iconClass: "text-amber-600 dark:text-amber-400" },
            { label: "Enviadas", value: enviadas, className: "", icon: CheckCircle2, iconClass: "text-primary" },
            { label: "Total", value: transfers.length, className: "", icon: BarChart2, iconClass: "text-primary" },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <metric.icon className={`size-4 shrink-0 ${metric.iconClass}`} />
                </div>
                {isLoading ? (
                  <div className="mt-1 h-7 w-24 animate-pulse rounded bg-muted" />
                ) : (
                  <p className={`mt-1 text-3xl font-bold ${metric.className}`}>{metric.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table card */}
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3 p-4 pb-3 sm:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_180px_auto]">
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
                  placeholder="Buscar por referencia, promotor, rep. o cliente"
                  className="h-10 pl-9 pr-9 text-sm"
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
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TransferStatus)} disabled={isLoading}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              {/* Advanced filters */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={advancedFilterCount > 0 ? "default" : "outline"}
                    className="h-10 gap-2"
                    disabled={isLoading}
                  >
                    <SlidersHorizontal className="size-4" />
                    Filtros
                    {advancedFilterCount > 0 && (
                      <span className="rounded bg-background/20 px-1.5 text-xs">{advancedFilterCount}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="max-h-[min(78svh,560px)] w-[calc(100vw-1.5rem)] overflow-y-auto p-0 sm:w-[min(94vw,600px)]">
                  <div className="border-b p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">Filtros avanzados</p>
                        <p className="text-sm text-muted-foreground">Filtra transferencias por promotor y rango de fechas.</p>
                      </div>
                      {advancedFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="w-full gap-2 sm:w-auto">
                          <X className="size-4" /> Limpiar todo
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-5 p-4">
                    <FilterSection icon={UserRound} title="Promotor">
                      <FilterField label="Promotor">
                        <SearchableSelect
                          value={filterPromotor}
                          onValueChange={setFilterPromotor}
                          options={promotorOptions}
                          allLabel="Todos los promotores"
                          searchPlaceholder="Buscar promotor…"
                          emptyLabel="No hay promotores"
                          disabled={isLoading}
                        />
                      </FilterField>
                    </FilterSection>
                    <Separator />
                    <FilterSection icon={CalendarDays} title="Fechas">
                      <FilterField label="Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm" />
                      </FilterField>
                      <FilterField label="Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm" />
                      </FilterField>
                    </FilterSection>
                  </div>
                </PopoverContent>
              </Popover>
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
          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ArrowRightLeft className="mb-4 size-12 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">
                  {activeFilters.length > 0 ? "No hay transferencias con los filtros seleccionados" : "No se encontraron transferencias"}
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
                        <TableHead>Referencia</TableHead>
                        <TableHead className="hidden sm:table-cell">Promotor</TableHead>
                        <TableHead className="hidden md:table-cell">Rep. de Venta</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden md:table-cell">Items</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayed.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">
                            <p className="font-mono font-medium leading-snug">{t.reference}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{t.promotor_name ?? "—"}</p>
                            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block md:hidden">{t.sales_representative_name ?? "—"}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{formatDate(t.created_at)}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{t.promotor_name ?? "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{t.sales_representative_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{t.customer_name ?? "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm">{t.items.length}</TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                          <TableCell><StatusBadge status={t.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              {t.status === "borrador" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-primary hover:text-primary"
                                    title="Enviar"
                                    onClick={() => setConfirmAction({ type: "submit", id: t.id, reference: t.reference })}
                                    disabled={isMutating}
                                  >
                                    <SendHorizonal className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-destructive hover:text-destructive"
                                    title="Cancelar"
                                    onClick={() => setConfirmAction({ type: "cancel", id: t.id, reference: t.reference })}
                                    disabled={isMutating}
                                  >
                                    <XCircle className="size-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                title="Ver detalle"
                                onClick={() => setSelected(t)}
                              >
                                <Eye className="size-4" />
                              </Button>
                            </div>
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
                    <span>Cargando más transferencias…</span>
                  </div>
                )}
                {!hasMoreDisplay && filtered.length > DISPLAY_PAGE && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {filtered.length} transferencias en total
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </ErrorDisabledContent>

      <TransferDetailSheet
        transfer={selected}
        onClose={() => setSelected(null)}
        isSuperadmin={true}
        onSubmit={(id) => setConfirmAction({ type: "submit", id, reference: selected?.reference ?? id })}
        onCancel={(id) => setConfirmAction({ type: "cancel", id, reference: selected?.reference ?? id })}
        isMutating={isMutating}
      />

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "submit" ? "¿Enviar transferencia?" : "¿Cancelar transferencia?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "submit"
                ? <>Se enviará la transferencia <span className="font-mono font-semibold">{confirmAction.reference}</span>. Esta acción no se puede deshacer.</>
                : <>Se cancelará la transferencia <span className="font-mono font-semibold">{confirmAction?.reference}</span>. Esta acción no se puede deshacer.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === "cancel" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "submit") submitMutation.mutate(confirmAction.id);
                else cancelMutation.mutate(confirmAction.id);
                setConfirmAction(null);
                setSelected(null);
              }}
            >
              {confirmAction?.type === "submit" ? "Enviar" : "Cancelar transferencia"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Page entry point ───────────────────────────────────────────────────────────

export default function Transfers() {
  const { user } = useAuth();
  const isSalesRep = user?.role === "sales_rep";
  return isSalesRep ? <SalesRepView /> : <SuperadminView />;
}
