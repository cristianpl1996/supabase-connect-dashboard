import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PackageX, AlertCircle, CheckCircle2, Hash, TrendingUp, PieChart as PieIcon, CalendarDays, Download, Loader2, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
  PieChart,
  Pie,
  Legend,
  ReferenceLine,
} from "recharts";
import type { Stockout } from "@/lib/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const REASONS = [
  "Sin stock en bodega",
  "Proveedor sin stock",
  "Producto descontinuado",
  "Producto en tránsito",
  "Otro",
];

const REASON_SHORT: Record<string, string> = {
  "Sin stock en bodega": "Sin stock",
  "Proveedor sin stock": "Proveedor",
  "Producto descontinuado": "Descontinuado",
  "Producto en tránsito": "En tránsito",
  "Otro": "Otro",
};

const PIE_GREENS = ["#14532d", "#166534", "#15803d", "#22c55e", "#86efac"];

const GREEN_START = "#22c55e";
const GREEN_END   = "#15803d";
const TICK_STYLE  = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };

const TOOLTIP_STYLE = {
  fontSize: 13,
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
  padding: "8px 12px",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={TOOLTIP_STYLE}>
      <span style={{ fontWeight: 600 }}>{name}</span>: {value}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
        <Icon className="size-3.5 text-primary" />
      </div>
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  );
}

function EmptyState({ height = 200 }: { height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 text-muted-foreground rounded-lg border border-dashed border-border bg-muted/20"
      style={{ height }}
    >
      <PackageX className="size-8 opacity-30" />
      <p className="text-sm">Sin datos disponibles</p>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reports: Stockout[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StockoutsDashboardModal({ open, onOpenChange, reports }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<"png" | "pdf" | null>(null);

  // ── Filters ──
  const [chartFilters, setChartFilters] = useState({ rep: "all", chartStatus: "all", dateRange: "all" });
  const { rep: filterRep, chartStatus: filterChartStatus, dateRange: filterDateRange } = chartFilters;

  useEffect(() => {
    if (open) setChartFilters({ rep: "all", chartStatus: "all", dateRange: "all" });
  }, [open]);

  const repOptions = useMemo(() => {
    const reps = [...new Set(reports.flatMap((r) => r.sales_rep_name ? [r.sales_rep_name] : []))] as string[];
    return reps.sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterRep !== "all" && r.sales_rep_name !== filterRep) return false;
      if (filterChartStatus !== "all" && r.status !== filterChartStatus) return false;
      if (filterDateRange !== "all") {
        const months = filterDateRange === "1m" ? 1 : filterDateRange === "3m" ? 3 : 6;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        if (new Date(r.reported_at) < cutoff) return false;
      }
      return true;
    });
  }, [reports, filterRep, filterChartStatus, filterDateRange]);

  const hasActiveFilters = filterRep !== "all" || filterChartStatus !== "all" || filterDateRange !== "all";

  // ── Stats ──
  const activos   = useMemo(() => filteredReports.filter((r) => r.status === "activo").length,   [filteredReports]);
  const resueltos = useMemo(() => filteredReports.filter((r) => r.status === "resuelto").length, [filteredReports]);
  const pct       = filteredReports.length > 0 ? Math.round((resueltos / filteredReports.length) * 100) : 0;

  // ── Chart data ──
  const topProducts = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReports.forEach((r) => {
      const key = r.product_name ?? r.product_sku;
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [filteredReports]);

  const byReason = useMemo(() =>
    REASONS.map((r, i) => ({
      reason: REASON_SHORT[r] ?? r,
      count: filteredReports.filter((rep) => rep.reason === r).length,
      color: PIE_GREENS[i % PIE_GREENS.length],
      gradId: `pie-${i}`,
    })),
    [filteredReports]
  );

  const timeline = useMemo(() => {
    const byMonth: Record<string, { label: string; ts: number; count: number }> = {};
    filteredReports.forEach((r) => {
      const date  = new Date(r.reported_at);
      const ts    = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const label = date.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
      if (!byMonth[label]) byMonth[label] = { label, ts, count: 0 };
      byMonth[label].count += 1;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.ts - b.ts)
      .map(({ label, count }) => ({ month: label, count }));
  }, [filteredReports]);

  const avgMonthly = useMemo(() =>
    timeline.length > 0
      ? Math.round(timeline.reduce((s, d) => s + d.count, 0) / timeline.length)
      : 0,
    [timeline]
  );

  const productChartH = Math.max(220, topProducts.length * 48);

  // ── Download ──
  const handleDownload = async (format: "png" | "pdf") => {
    if (!contentRef.current || downloading) return;
    setDownloading(format);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const el = contentRef.current;

      const scrollParent = el.parentElement;
      let prevOverflow = "";
      let prevHeight   = "";
      if (scrollParent) {
        prevOverflow = scrollParent.style.overflow;
        prevHeight   = scrollParent.style.height;
        scrollParent.style.overflow = "visible";
        scrollParent.style.height   = "auto";
      }

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        height: el.scrollHeight,
        windowHeight: el.scrollHeight + 200,
        ignoreElements: (element) => element.hasAttribute("data-pdf-exclude"),
      });

      if (scrollParent) {
        scrollParent.style.overflow = prevOverflow;
        scrollParent.style.height   = prevHeight;
      }

      if (format === "png") {
        const link = document.createElement("a");
        link.download = `agotados-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const { default: jsPDF } = await import("jspdf");
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "px",
          format: [canvas.width / 2, canvas.height / 2],
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(`agotados-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] flex flex-col p-0">
        {/* ── Header ── */}
        <div className="shrink-0 bg-background border-b border-border px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
          <DialogHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <div className="shrink-0 flex size-7 sm:size-8 items-center justify-center rounded-lg bg-primary/10">
                    <PackageX className="size-4 text-primary" />
                  </div>
                  Análisis de Agotados
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  {filteredReports.length} reporte{filteredReports.length !== 1 ? "s" : ""} en total ·{" "}
                  <span className="font-medium text-foreground">{pct}% resueltos</span>
                  {hasActiveFilters && (
                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      filtrado
                    </span>
                  )}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1 sm:flex-none"
                  disabled={!!downloading || reports.length === 0}
                  onClick={() => handleDownload("png")}
                >
                  {downloading === "png" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1 sm:flex-none"
                  disabled={!!downloading || reports.length === 0}
                  onClick={() => handleDownload("pdf")}
                >
                  {downloading === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto flex-1">
          <div ref={contentRef} className="px-4 sm:px-6 pb-8 pt-4 sm:pt-5 space-y-5 sm:space-y-6 bg-background">
            {/* ── Stats ── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Activos</p>
                    <p className="mt-0.5 sm:mt-1 text-2xl sm:text-4xl font-bold text-destructive leading-none">{activos}</p>
                  </div>
                  <div className="shrink-0 hidden sm:flex size-9 items-center justify-center rounded-lg bg-destructive/10">
                    <AlertCircle className="size-5 text-destructive" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive transition-all"
                    style={{ width: filteredReports.length ? `${(activos / filteredReports.length) * 100}%` : "0%" }}
                  />
                </div>
                <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-muted-foreground">
                  {filteredReports.length ? `${Math.round((activos / filteredReports.length) * 100)}%` : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Resueltos</p>
                    <p className="mt-0.5 sm:mt-1 text-2xl sm:text-4xl font-bold text-primary leading-none">{resueltos}</p>
                  </div>
                  <div className="shrink-0 hidden sm:flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <CheckCircle2 className="size-5 text-primary" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-muted-foreground">{pct}%</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="mt-0.5 sm:mt-1 text-2xl sm:text-4xl font-bold text-foreground leading-none">{filteredReports.length}</p>
                  </div>
                  <div className="shrink-0 hidden sm:flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Hash className="size-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-full rounded-full bg-border" />
                </div>
                <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-xs text-muted-foreground">reportes</p>
              </div>
            </div>

            {/* ── Filters (hidden in PDF export) ── */}
            <div data-pdf-exclude className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4 ">
              <p className="text-xs font-semibold text-muted-foreground  tracking-wide mb-2 sm:mb-3">Filtros</p>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                {repOptions.length > 1 && (
                  <Select value={filterRep} onValueChange={(v) => setChartFilters((f) => ({ ...f, rep: v }))}>
                    <SelectTrigger className="h-9 text-sm w-60 w-full sm:w-60 sm:min-w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los representantes</SelectItem>
                      {repOptions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={filterChartStatus} onValueChange={(v) => setChartFilters((f) => ({ ...f, chartStatus: v }))}>
                  <SelectTrigger className="h-9 text-sm w-full sm:w-auto sm:min-w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="resuelto">Resueltos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterDateRange} onValueChange={(v) => setChartFilters((f) => ({ ...f, dateRange: v }))}>
                  <SelectTrigger className="h-9 text-sm w-full sm:w-auto sm:min-w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el tiempo</SelectItem>
                    <SelectItem value="1m">Último mes</SelectItem>
                    <SelectItem value="3m">Últimos 3 meses</SelectItem>
                    <SelectItem value="6m">Últimos 6 meses</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => { setFilterRep("all"); setFilterChartStatus("all"); setFilterDateRange("all"); }}
                    className="inline-flex h-9 w-full sm:w-auto items-center justify-center sm:justify-start gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border sm:border-0"
                  >
                    <X className="size-3.5" /> Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* ── Top productos ── */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
              <SectionHeader icon={TrendingUp} title="Top productos con más agotados" />
              {topProducts.length === 0 ? (
                <EmptyState height={220} />
              ) : (
                <ResponsiveContainer width="100%" height={productChartH}>
                  <BarChart
                    data={topProducts}
                    layout="vertical"
                    margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="bar-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor={GREEN_START} />
                        <stop offset="100%" stopColor={GREEN_END}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.6} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={TICK_STYLE}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ ...TICK_STYLE, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 14) + "…" : v}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [v, "Reportes"]}
                    />
                    <Bar dataKey="count" fill="url(#bar-grad)" radius={[0, 6, 6, 0]} maxBarSize={28}>
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ fontSize: 12, fontWeight: 600, fill: "hsl(var(--foreground))" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Razones + Timeline en 2 columnas ── */}
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm grid gap-5 sm:gap-6 sm:grid-cols-2" >
              {/* Por motivo */}
              <div>
                <SectionHeader icon={PieIcon} title="Reportes por motivo" />
                {filteredReports.length === 0 ? (
                  <EmptyState height={240} />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <defs>
                        {byReason.map((d) => (
                          <linearGradient key={d.gradId} id={d.gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor={d.color} stopOpacity={1}   />
                            <stop offset="100%" stopColor={d.color} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={byReason}
                        dataKey="count"
                        nameKey="reason"
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        strokeWidth={0}
                        label={({ percent }) => percent > 0 ? `${Math.round(percent * 100)}%` : ""}
                        labelLine={false}
                      >
                        {byReason.map((d) => (
                          <Cell key={d.reason} fill={`url(#${d.gradId})`} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Línea de tiempo */}
              <div>
                <SectionHeader icon={CalendarDays} title="Reportes por mes" />
                {timeline.length === 0 ? (
                  <EmptyState height={240} />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={timeline} margin={{ top: 20, right: 16, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={GREEN_START} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={GREEN_START} stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="hsl(var(--border))"
                        opacity={0.7}
                      />
                      <XAxis
                        dataKey="month"
                        tick={TICK_STYLE}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={TICK_STYLE}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: number) => [v, "Reportes"]}
                      />
                      {timeline.length > 1 && (
                        <ReferenceLine
                          y={avgMonthly}
                          stroke={GREEN_END}
                          strokeDasharray="6 3"
                          strokeWidth={1.5}
                          label={{
                            value: `Prom. ${avgMonthly}`,
                            position: "insideTopRight",
                            fontSize: 10,
                            fill: GREEN_END,
                            fontWeight: 600,
                          }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={GREEN_START}
                        strokeWidth={2.5}
                        fill="url(#area-grad)"
                        dot={{ r: 5, fill: GREEN_START, stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: GREEN_START, stroke: "#fff", strokeWidth: 2 }}
                      >
                        <LabelList
                          dataKey="count"
                          position="top"
                          className="text-xs font-bold"
                          style={{ fontWeight: 700, fill: "hsl(var(--foreground))" }}
                        />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
