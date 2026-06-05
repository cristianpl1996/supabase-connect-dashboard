import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
import { CalendarPromotion, listCalendarPromotions } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PromotionDetailsSheet } from '@/components/promotions/PromotionDetailsSheet';
import { ModuleErrorCard } from '@/components/common/ModuleErrorCard';
import { ErrorDisabledContent } from '@/components/common/ErrorDisabledContent';
import { PageHeader } from '@/components/common/PageHeader';
import { ChevronLeft, ChevronRight, AlertTriangle, CalendarDays, Layers, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, getDay, addMonths, subMonths, differenceInDays, isBefore, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Antipulgas:     { bg: 'bg-sky-100 dark:bg-sky-900/30',      border: 'border-sky-400',     text: 'text-sky-800 dark:text-sky-200' },
  Antibioticos:   { bg: 'bg-amber-100 dark:bg-amber-900/30',  border: 'border-amber-400',   text: 'text-amber-800 dark:text-amber-200' },
  Nutricion:      { bg: 'bg-lime-100 dark:bg-lime-900/30',    border: 'border-lime-500',    text: 'text-lime-800 dark:text-lime-200' },
  Vacunas:        { bg: 'bg-violet-100 dark:bg-violet-900/30',border: 'border-violet-400',  text: 'text-violet-800 dark:text-violet-200' },
  Desparasitantes:{ bg: 'bg-rose-100 dark:bg-rose-900/30',    border: 'border-rose-400',    text: 'text-rose-800 dark:text-rose-200' },
  Dermatologia:   { bg: 'bg-cyan-100 dark:bg-cyan-900/30',    border: 'border-cyan-400',    text: 'text-cyan-800 dark:text-cyan-200' },
  Analgesicos:    { bg: 'bg-orange-100 dark:bg-orange-900/30',border: 'border-orange-400',  text: 'text-orange-800 dark:text-orange-200' },
  Suplementos:    { bg: 'bg-teal-100 dark:bg-teal-900/30',    border: 'border-teal-400',    text: 'text-teal-800 dark:text-teal-200' },
  default:        { bg: 'bg-primary/10 dark:bg-primary/20',   border: 'border-primary/50',  text: 'text-primary' },
};

const STATUS_STYLES: Record<string, string> = {
  activa:     'bg-emerald-50 text-emerald-700 border-emerald-300',
  borrador:   'bg-white text-gray-900 border-gray-300',
  cancelada:  'bg-red-50 text-red-700 border-red-300',
  finalizada: 'bg-slate-100 text-slate-500 border-slate-300',
  revision:   'bg-amber-50 text-amber-700 border-amber-300',
  aprobada:   'bg-blue-50 text-blue-700 border-blue-300',
  pausada:    'bg-orange-50 text-orange-700 border-orange-300',
};

const BAR_STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  activa:     { bg: 'bg-primary/10',  border: 'border-primary',     text: 'text-primary' },
  borrador:   { bg: 'bg-gray-100',    border: 'border-gray-300',    text: 'text-gray-700' },
  cancelada:  { bg: 'bg-red-50',      border: 'border-red-400',     text: 'text-red-700' },
  finalizada: { bg: 'bg-slate-100',   border: 'border-slate-400',   text: 'text-slate-600' },
  revision:   { bg: 'bg-amber-50',    border: 'border-amber-400',   text: 'text-amber-700' },
  aprobada:   { bg: 'bg-blue-50',     border: 'border-blue-400',    text: 'text-blue-700' },
  pausada:    { bg: 'bg-orange-50',   border: 'border-orange-400',  text: 'text-orange-700' },
};

const STATUS_LABELS: Record<string, string> = {
  activa:     'Activa',
  borrador:   'Borrador',
  cancelada:  'Cancelada',
  finalizada: 'Finalizada',
  revision:   'En revisión',
  aprobada:   'Aprobada',
  pausada:    'Pausada',
};

const FALLBACK_COLORS = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-400', text: 'text-indigo-800 dark:text-indigo-200' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-400', text: 'text-pink-800 dark:text-pink-200' },
  { bg: 'bg-lime-100 dark:bg-lime-900/30', border: 'border-lime-400', text: 'text-lime-800 dark:text-lime-200' },
  { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', border: 'border-fuchsia-400', text: 'text-fuchsia-800 dark:text-fuchsia-200' },
];

function getCategoryColor(category: string, dynamicMap: Map<string, typeof CATEGORY_COLORS.default>) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  if (dynamicMap.has(category)) return dynamicMap.get(category)!;
  const idx = dynamicMap.size % FALLBACK_COLORS.length;
  const color = FALLBACK_COLORS[idx];
  dynamicMap.set(category, color);
  return color;
}

interface GanttPromo {
  id: string;
  title: string;
  labName: string;
  category: string;
  startDate: Date;
  endDate: Date;
  status: string;
  estimatedCost: number;
  hasConflict: boolean;
  conflictWith: string[];
  promotion: { id: string };
}

const Calendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedLab, setSelectedLab] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);

  const {
    data: promotions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['calendar-promotions'],
    queryFn: listCalendarPromotions,
    staleTime: 60_000,
  });

  const ganttItems = useMemo(() => {
    const dynamicColorMap = new Map<string, typeof CATEGORY_COLORS.default>();
    const items: GanttPromo[] = promotions.map((promo) => ({
      id: promo.id,
      title: promo.title,
      labName: promo.laboratory_name || 'Sin Laboratorio',
      category: promo.derived_category,
      startDate: parseISO(promo.start_date),
      endDate: parseISO(promo.end_date),
      status: promo.status,
      estimatedCost: promo.estimated_cost || 0,
      hasConflict: promo.has_conflict,
      conflictWith: promo.conflict_with,
      promotion: { id: promo.id },
    }));
    items.forEach((item) => {
      getCategoryColor(item.category, dynamicColorMap);
    });
    return { items, dynamicColorMap };
  }, [promotions]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const visibleItems = useMemo(
    () =>
      ganttItems.items.filter((item) => {
        if (selectedLab !== 'all' && item.labName !== selectedLab) return false;
        if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
        return !(isAfter(item.startDate, monthEnd) || isBefore(item.endDate, monthStart));
      }),
    [ganttItems.items, selectedLab, selectedStatus, monthEnd, monthStart],
  );

  const allLabs = useMemo(() => Array.from(new Set(ganttItems.items.map((item) => item.labName))).filter(Boolean).sort(), [ganttItems.items]);
  const allStatuses = useMemo(() => Array.from(new Set(ganttItems.items.map((item) => item.status))).sort(), [ganttItems.items]);
  const conflictCount = useMemo(() => ganttItems.items.filter((item) => item.hasConflict).length, [ganttItems.items]);

  const formatCurrency = (value: number) => COP_FORMATTER.format(value);

  const ganttRows = useMemo(
    () =>
      visibleItems.map((item) => {
        const colors = getCategoryColor(item.category, ganttItems.dynamicColorMap);
        const barStart = isBefore(item.startDate, monthStart) ? monthStart : item.startDate;
        const barEnd = isAfter(item.endDate, monthEnd) ? monthEnd : item.endDate;
        const startCol = barStart.getDate();
        const endCol = barEnd.getDate();
        return {
          ...item,
          colors,
          startCol,
          spanDays: endCol - startCol + 1,
          totalDays: differenceInDays(item.endDate, item.startDate) + 1,
        };
      }),
    [visibleItems, ganttItems.dynamicColorMap, monthStart, monthEnd],
  );

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 sm:space-y-6">
      <ErrorDisabledContent disabled={isError}>
      <PageHeader
        icon={CalendarDays}
        title="Calendario Comercial"
        description="Linea de tiempo de promociones con deteccion de canibalizacion"
        actions={(
          <div className="flex items-center gap-2">
            <Select value={selectedLab} onValueChange={setSelectedLab} disabled={isLoading}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Todos los laboratorios" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50">
                <SelectItem value="all">Todos los laboratorios</SelectItem>
                {allLabs.map((lab) => (
                  <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus} disabled={isLoading}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50">
                <SelectItem value="all">Todos los estados</SelectItem>
                {allStatuses.map((st) => (
                  <SelectItem key={st} value={st}>
                    {STATUS_LABELS[st] ?? st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />
      </ErrorDisabledContent>

      {isError && (
        <ModuleErrorCard
          message={error instanceof Error ? error.message : 'Error al cargar el calendario'}
          onRetry={() => void refetch()}
          loading={isLoading}
        />
      )}

      <ErrorDisabledContent disabled={isError} className="space-y-5 sm:space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Promociones este mes</CardTitle>
            <CalendarDays className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted shadow-sm" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{visibleItems.length}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Categorias activas</CardTitle>
            <Layers className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted shadow-sm" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{new Set(visibleItems.map((item) => item.category)).size}</p>
            )}
          </CardContent>
        </Card>

        <Card className={`border-border/50 shadow-sm ${conflictCount > 0 ? 'border-destructive/50' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conflictos detectados</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${conflictCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted shadow-sm" />
            ) : (
              <>
                <p className={`text-2xl font-bold ${conflictCount > 0 ? 'text-destructive' : 'text-foreground'}`}>{conflictCount}</p>
                {conflictCount > 0 && <p className="text-xs text-muted-foreground mt-1">Promociones de la misma categoria se superponen</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))} disabled={isLoading}>
                <ChevronLeft className="size-4" />
              </Button>
              <h2 className="min-w-0 flex-1 text-center text-base font-semibold capitalize text-foreground sm:min-w-[200px] sm:text-xl">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))} disabled={isLoading}>
                <ChevronRight className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} disabled={isLoading} className="text-xs text-muted-foreground">
                Hoy
              </Button>
            </div>
            <div className="hidden lg:flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3" />
                <span>Estados:</span>
              </div>
              {allStatuses.map((st) => (
                <div key={st} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[st] ?? 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                    {STATUS_LABELS[st] ?? st}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-6">
          {isLoading ? (
            <div className="space-y-3">
              {["week-1", "week-2", "week-3", "week-4", "week-5"].map((slot) => (
                <div key={slot} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {ganttRows.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay promociones en este mes</p>
                </div>
              ) : (
                ganttRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="w-full rounded-md border bg-card p-3 text-left"
                    onClick={() => {
                      setSelectedPromoId(row.promotion.id);
                      setDetailsOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.title}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{row.labName}</p>
                      </div>
                      {row.hasConflict && <AlertTriangle className="size-4 shrink-0 text-destructive" />}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${row.labName === 'Sin Laboratorio' ? 'bg-white text-gray-900 border-gray-300' : 'border-primary/30 bg-primary/8 text-primary'}`}>
                        {row.labName}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {format(row.startDate, 'dd MMM', { locale: es })} - {format(row.endDate, 'dd MMM yyyy', { locale: es })} ({row.totalDays} dias)
                    </p>
                    <p className="mt-1 text-sm font-medium">{formatCurrency(row.estimatedCost)}</p>
                  </button>
                ))
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <div className="min-w-[900px]">
                <div className="grid gap-px mb-1" style={{ gridTemplateColumns: `180px repeat(${daysInMonth.length}, 1fr)` }}>
                  <div className="text-xs font-medium text-muted-foreground p-2">Promocion</div>
                  {daysInMonth.map((day) => {
                    const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                    return (
                      <div
                        key={day.toISOString()}
                        className={`text-center p-1 text-xs rounded-t ${isToday ? 'bg-primary/10 text-primary font-bold' : isWeekend ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}
                      >
                        <div className="font-medium">{format(day, 'd')}</div>
                        <div className="text-[10px]">{dayNames[getDay(day)]}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1">
                  {ganttRows.length === 0 ? (
                    <div className="text-center py-16">
                      <CalendarDays className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay promociones en este mes</p>
                    </div>
                  ) : (
                    ganttRows.map((row) => (
                      <div key={row.id} className="grid gap-px items-center" style={{ gridTemplateColumns: `180px repeat(${daysInMonth.length}, 1fr)` }}>
                        <div className="flex items-center gap-1.5 pr-2 min-w-0">
                          {row.hasConflict && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="font-medium text-destructive">Conflicto Comercial</p>
                                <p className="text-xs mt-1">Se superpone con: {row.conflictWith.join(', ')}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <span className="text-xs font-medium text-foreground truncate">{row.labName}</span>
                        </div>

                        {daysInMonth.map((day, dayIdx) => {
                          const dayNum = dayIdx + 1;
                          const isInBar = dayNum >= row.startCol && dayNum < row.startCol + row.spanDays;
                          const isBarStart = dayNum === row.startCol;
                          const isBarEnd = dayNum === row.startCol + row.spanDays - 1;
                          if (!isInBar) return <div key={day.toISOString()} className="h-9" />;
                          return (
                            <Tooltip key={day.toISOString()}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className={`h-9 appearance-none border-x-0 border-y-2 p-0 text-left font-[inherit] cursor-pointer transition-all hover:opacity-80 ${(() => { const s = BAR_STATUS_STYLES[row.status] ?? BAR_STATUS_STYLES.borrador; return `${s.bg} ${s.text}`; })()} ${row.hasConflict ? 'border-destructive' : (BAR_STATUS_STYLES[row.status] ?? BAR_STATUS_STYLES.borrador).border} ${isBarStart ? 'rounded-l-md border-l-2 pl-1.5' : ''} ${isBarEnd ? 'rounded-r-md border-r-2' : ''} flex items-center overflow-hidden`}
                                  onClick={() => {
                                    setSelectedPromoId(row.promotion.id);
                                    setDetailsOpen(true);
                                  }}
                                >
                                  {isBarStart && (
                                    <span className="text-[11px] font-medium truncate leading-tight">
                                      {row.hasConflict && '⚠ '}
                                      {row.status === 'revision' && '🕐 '}
                                      {row.title}
                                    </span>
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs z-50 p-3">
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold leading-tight">{row.title}</p>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                                      {STATUS_LABELS[row.status] ?? row.status}
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
                                      {row.labName}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {format(row.startDate, 'dd MMM', { locale: es })} — {format(row.endDate, 'dd MMM yyyy', { locale: es })} · {row.totalDays} días
                                  </p>
                                  {row.hasConflict && (
                                    <p className="text-xs font-medium text-destructive">⚠ Conflicto con: {row.conflictWith.join(', ')}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <PromotionDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        promotionId={selectedPromoId}
      />
      </ErrorDisabledContent>
    </div>
  );
};

export default Calendar;
