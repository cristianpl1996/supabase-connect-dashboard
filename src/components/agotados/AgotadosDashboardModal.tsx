import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PackageX, AlertCircle, CheckCircle2, Hash, TrendingUp, PieChart as PieIcon, CalendarDays, Download, Loader2 } from "lucide-react";
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
} from "recharts";
import type { Agotado } from "@/lib/api";

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

// Green palette — indexed so SVG gradient IDs never contain spaces
const PIE_GREENS = ["#14532d", "#166534", "#15803d", "#22c55e", "#86efac"];

const GREEN_START = "#22c55e";
const GREEN_END   = "#15803d";
const TICK_STYLE  = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };

// ── Helpers ────────────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  fontSize: 13,
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
  padding: "8px 12px",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
};

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={TOOLTIP_STYLE}>
      <span style={{ fontWeight: 600 }}>{name}</span>: {value}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
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
  reports: Agotado[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AgotadosDashboardModal({ open, onOpenChange, reports }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState<"png" | "pdf" | null>(null);

  const activos   = useMemo(() => reports.filter((r) => r.status === "activo").length,   [reports]);
  const resueltos = useMemo(() => reports.filter((r) => r.status === "resuelto").length, [reports]);
  const pct       = reports.length > 0 ? Math.round((resueltos / reports.length) * 100) : 0;

  const topProducts = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach((r) => {
      const key = r.product_name ?? r.product_sku;
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [reports]);

  const byReason = useMemo(() =>
    REASONS.map((r, i) => ({
      reason: REASON_SHORT[r] ?? r,
      count: reports.filter((rep) => rep.reason === r).length,
      color: PIE_GREENS[i % PIE_GREENS.length],
      gradId: `pie-${i}`,
    })),
    [reports]
  );

  const timeline = useMemo(() => {
    const byMonth: Record<string, { label: string; ts: number; count: number }> = {};
    reports.forEach((r) => {
      const date = new Date(r.reported_at);
      const ts   = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const label = date.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
      if (!byMonth[label]) byMonth[label] = { label, ts, count: 0 };
      byMonth[label].count += 1;
    });
    return Object.values(byMonth)
      .sort((a, b) => a.ts - b.ts)
      .map(({ label, count }) => ({ month: label, count }));
  }, [reports]);

  const productChartH = Math.max(220, topProducts.length * 48);

  const handleDownload = async (format: "png" | "pdf") => {
    if (!contentRef.current || downloading) return;
    setDownloading(format);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      if (format === "png") {
        const link = document.createElement("a");
        link.download = `agotados-dashboard-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const { default: jsPDF } = await import("jspdf");
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save(`agotados-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        {/* ── Header ── */}
        <div className="shrink-0 bg-background border-b border-border px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <PackageX className="size-4.5 text-primary" />
                  </div>
                  Análisis de Agotados
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
                  {reports.length} reporte{reports.length !== 1 ? "s" : ""} en total ·{" "}
                  <span className="font-medium text-foreground">{pct}% resueltos</span>
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!!downloading || reports.length === 0}
                  onClick={() => handleDownload("png")}
                >
                  {downloading === "png" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!!downloading || reports.length === 0}
                  onClick={() => handleDownload("pdf")}
                >
                  {downloading === "pdf" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  PDF
                </Button>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto flex-1">
        <div ref={contentRef} className="px-6 pb-8 pt-5 space-y-8 bg-background">
          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-4">
            {/* Activos */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activos</p>
                  <p className="mt-1 text-4xl font-bold text-destructive">{activos}</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertCircle className="size-5 text-destructive" />
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-destructive transition-all"
                  style={{ width: reports.length ? `${(activos / reports.length) * 100}%` : "0%" }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {reports.length ? `${Math.round((activos / reports.length) * 100)}% del total` : "—"}
              </p>
            </div>

            {/* Resueltos */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resueltos</p>
                  <p className="mt-1 text-4xl font-bold text-primary">{resueltos}</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <CheckCircle2 className="size-5 text-primary" />
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{pct}% del total</p>
            </div>

            {/* Total */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                  <p className="mt-1 text-4xl font-bold text-foreground">{reports.length}</p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <Hash className="size-5 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-full rounded-full bg-border" />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">reportes registrados</p>
            </div>
          </div>

          {/* ── Top productos ── */}
          <div>
            <SectionHeader icon={TrendingUp} title="Top productos con más agotados" />
            {topProducts.length === 0 ? (
              <EmptyState height={220} />
            ) : (
              <ResponsiveContainer width="100%" height={productChartH}>
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
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
                    width={160}
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v}
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
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Por motivo */}
            <div>
              <SectionHeader icon={PieIcon} title="Reportes por motivo" />
              {reports.length === 0 ? (
                <EmptyState height={240} />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <defs>
                      {byReason.map((d) => (
                        <linearGradient key={d.gradId} id={d.gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={d.color} stopOpacity={1}    />
                          <stop offset="100%" stopColor={d.color} stopOpacity={0.7}  />
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
                <EmptyState height={220} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={GREEN_START} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={GREEN_START} stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                    <XAxis
                      dataKey="month"
                      tick={TICK_STYLE}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number) => [v, "Reportes"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={GREEN_START}
                      strokeWidth={2.5}
                      fill="url(#area-grad)"
                      dot={{ r: 4, fill: GREEN_START, stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: GREEN_START, stroke: "#fff", strokeWidth: 2 }}
                    />
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
