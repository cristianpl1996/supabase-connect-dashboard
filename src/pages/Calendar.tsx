import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Promotion, PromoMechanic } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PromotionDetailsSheet } from '@/components/promotions/PromotionDetailsSheet';
import { 
  ChevronLeft, ChevronRight, AlertTriangle, CalendarDays, 
  Layers, Info 
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isWithinInterval, parseISO, isSameMonth, getDay,
  addMonths, subMonths, differenceInDays, isBefore, isAfter,
  startOfDay, endOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';

interface PromotionWithLab extends Promotion {
  laboratories?: { name: string } | null;
}

// Color palette for categories - using semantic-friendly HSL-based colors
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Antipulgas': { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-400', text: 'text-blue-800 dark:text-blue-200' },
  'Antibióticos': { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-400', text: 'text-amber-800 dark:text-amber-200' },
  'Nutrición': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-400', text: 'text-emerald-800 dark:text-emerald-200' },
  'Vacunas': { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-400', text: 'text-purple-800 dark:text-purple-200' },
  'Desparasitantes': { bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-400', text: 'text-rose-800 dark:text-rose-200' },
  'Dermatología': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-400', text: 'text-cyan-800 dark:text-cyan-200' },
  'Analgésicos': { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-400', text: 'text-orange-800 dark:text-orange-200' },
  'Suplementos': { bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-400', text: 'text-teal-800 dark:text-teal-200' },
  'default': { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground' },
};

const FALLBACK_COLORS = [
  { bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-400', text: 'text-indigo-800 dark:text-indigo-200' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-400', text: 'text-pink-800 dark:text-pink-200' },
  { bg: 'bg-lime-100 dark:bg-lime-900/30', border: 'border-lime-400', text: 'text-lime-800 dark:text-lime-200' },
  { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', border: 'border-fuchsia-400', text: 'text-fuchsia-800 dark:text-fuchsia-200' },
];

function getCategoryColor(category: string, dynamicMap: Map<string, typeof CATEGORY_COLORS['default']>) {
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
  promotion: PromotionWithLab;
  mechanic?: PromoMechanic;
}

const Calendar = () => {
  const [promotions, setPromotions] = useState<PromotionWithLab[]>([]);
  const [mechanics, setMechanics] = useState<Record<string, PromoMechanic[]>>({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Detail sheet
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<PromotionWithLab | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [promosRes, mechRes] = await Promise.all([
        supabase
          .from('promotions')
          .select('*, laboratories(name)')
          .order('start_date', { ascending: true }),
        supabase.from('promo_mechanics').select('*'),
      ]);

      if (promosRes.error) throw promosRes.error;
      setPromotions(promosRes.data || []);

      if (mechRes.data) {
        const map: Record<string, PromoMechanic[]> = {};
        mechRes.data.forEach(m => {
          if (!map[m.promo_id]) map[m.promo_id] = [];
          map[m.promo_id].push(m);
        });
        setMechanics(map);
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derive category from mechanic condition_config or target_segment
  const getCategory = useCallback((promo: PromotionWithLab): string => {
    const promoMechs = mechanics[promo.id];
    if (promoMechs && promoMechs.length > 0) {
      const config = promoMechs[0].condition_config as Record<string, unknown> | null;
      if (config?.category) return String(config.category);
    }
    const segment = promo.target_segment as Record<string, unknown> | null;
    if (segment?.category) return String(segment.category);
    if (segment?.type && segment.type !== 'all' && segment.type !== 'todo') return String(segment.type);
    return 'General';
  }, [mechanics]);

  // Build Gantt items with conflict detection
  const ganttItems = useMemo(() => {
    const dynamicColorMap = new Map<string, typeof CATEGORY_COLORS['default']>();
    
    const items: GanttPromo[] = promotions.map(promo => ({
      id: promo.id,
      title: promo.title,
      labName: promo.laboratories?.name || 'Sin Lab',
      category: getCategory(promo),
      startDate: parseISO(promo.start_date),
      endDate: parseISO(promo.end_date),
      status: promo.status,
      estimatedCost: promo.estimated_cost || 0,
      hasConflict: false,
      conflictWith: [],
      promotion: promo,
      mechanic: mechanics[promo.id]?.[0],
    }));

    // Detect overlaps within same category
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.category === b.category && a.category !== 'General') {
          const overlaps = !(isAfter(a.startDate, b.endDate) || isBefore(a.endDate, b.startDate));
          if (overlaps) {
            a.hasConflict = true;
            b.hasConflict = true;
            if (!a.conflictWith.includes(b.title)) a.conflictWith.push(b.title);
            if (!b.conflictWith.includes(a.title)) b.conflictWith.push(a.title);
          }
        }
      }
    }

    // Assign colors
    items.forEach(item => {
      getCategoryColor(item.category, dynamicColorMap);
    });

    return { items, dynamicColorMap };
  }, [promotions, mechanics, getCategory]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0=Sun

  // Filter promotions visible in this month
  const visibleItems = useMemo(() => {
    return ganttItems.items.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      // Check if promo overlaps with current month
      return !(isAfter(item.startDate, monthEnd) || isBefore(item.endDate, monthStart));
    });
  }, [ganttItems.items, currentMonth, selectedCategory, monthStart, monthEnd]);

  // Get unique categories for filter
  const allCategories = useMemo(() => {
    const cats = new Set(ganttItems.items.map(i => i.category));
    return Array.from(cats).sort();
  }, [ganttItems.items]);

  // Conflict count
  const conflictCount = useMemo(() => {
    return ganttItems.items.filter(i => i.hasConflict).length;
  }, [ganttItems.items]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handlePromoClick = (promo: PromotionWithLab) => {
    setSelectedPromo(promo);
    setDetailsOpen(true);
  };

  // Build Gantt rows for the month view
  const ganttRows = useMemo(() => {
    return visibleItems.map(item => {
      const colors = getCategoryColor(item.category, ganttItems.dynamicColorMap);
      
      // Clamp to month boundaries
      const barStart = isBefore(item.startDate, monthStart) ? monthStart : item.startDate;
      const barEnd = isAfter(item.endDate, monthEnd) ? monthEnd : item.endDate;
      
      const startCol = barStart.getDate(); // 1-indexed day of month
      const endCol = barEnd.getDate();
      const spanDays = endCol - startCol + 1;

      return {
        ...item,
        colors,
        startCol,
        spanDays,
        totalDays: differenceInDays(item.endDate, item.startDate) + 1,
      };
    });
  }, [visibleItems, ganttItems.dynamicColorMap, monthStart, monthEnd]);

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calendario Comercial</h1>
            <p className="text-muted-foreground mt-1">
              Línea de tiempo de promociones con detección de canibalización
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Category filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar categoría" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md z-50">
                <SelectItem value="all">Todas las categorías</SelectItem>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Promociones este mes
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{visibleItems.length}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categorías activas
              </CardTitle>
              <Layers className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {new Set(visibleItems.map(i => i.category)).size}
              </p>
            </CardContent>
          </Card>

          <Card className={`border-border/50 shadow-sm ${conflictCount > 0 ? 'border-destructive/50' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conflictos detectados
              </CardTitle>
              <AlertTriangle className={`h-4 w-4 ${conflictCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${conflictCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {conflictCount}
              </p>
              {conflictCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Promociones de la misma categoría se superponen
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Month Navigation */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold text-foreground capitalize min-w-[200px] text-center">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                  className="text-xs text-muted-foreground"
                >
                  Hoy
                </Button>
              </div>
              {/* Legend */}
              <div className="hidden lg:flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>Leyenda:</span>
                </div>
                {allCategories.slice(0, 6).map(cat => {
                  const colors = getCategoryColor(cat, ganttItems.dynamicColorMap);
                  return (
                    <div key={cat} className="flex items-center gap-1.5">
                      <div className={`h-3 w-8 rounded-sm border ${colors.bg} ${colors.border}`} />
                      <span className="text-xs text-muted-foreground">{cat}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Gantt Grid */}
                <div className="min-w-[900px]">
                  {/* Day headers */}
                  <div 
                    className="grid gap-px mb-1" 
                    style={{ gridTemplateColumns: `180px repeat(${daysInMonth.length}, 1fr)` }}
                  >
                    <div className="text-xs font-medium text-muted-foreground p-2">
                      Promoción
                    </div>
                    {daysInMonth.map(day => {
                      const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                      return (
                        <div
                          key={day.toISOString()}
                          className={`text-center p-1 text-xs rounded-t ${
                            isToday
                              ? 'bg-primary/10 text-primary font-bold'
                              : isWeekend
                                ? 'text-muted-foreground/60'
                                : 'text-muted-foreground'
                          }`}
                        >
                          <div className="font-medium">{format(day, 'd')}</div>
                          <div className="text-[10px]">{dayNames[getDay(day)]}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Today indicator line */}
                  <div
                    className="grid gap-px mb-0.5"
                    style={{ gridTemplateColumns: `180px repeat(${daysInMonth.length}, 1fr)` }}
                  >
                    <div />
                    {daysInMonth.map(day => {
                      const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      return (
                        <div key={day.toISOString()} className={`h-0.5 ${isToday ? 'bg-primary' : 'bg-border/30'}`} />
                      );
                    })}
                  </div>

                  {/* Gantt Rows */}
                  {ganttRows.length === 0 ? (
                    <div className="text-center py-16">
                      <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay promociones en este mes</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {ganttRows.map(row => (
                        <div
                          key={row.id}
                          className="grid gap-px items-center"
                          style={{ gridTemplateColumns: `180px repeat(${daysInMonth.length}, 1fr)` }}
                        >
                          {/* Label */}
                          <div className="flex items-center gap-1.5 pr-2 min-w-0">
                            {row.hasConflict && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs">
                                  <p className="font-medium text-destructive">⚠️ Conflicto Comercial</p>
                                  <p className="text-xs mt-1">
                                    Se superpone con: {row.conflictWith.join(', ')}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <span className="text-xs font-medium text-foreground truncate">
                              {row.labName}
                            </span>
                          </div>

                          {/* Day cells with bar */}
                          {daysInMonth.map((day, dayIdx) => {
                            const dayNum = dayIdx + 1;
                            const isInBar = dayNum >= row.startCol && dayNum < row.startCol + row.spanDays;
                            const isBarStart = dayNum === row.startCol;
                            const isBarEnd = dayNum === row.startCol + row.spanDays - 1;
                            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                            if (isInBar) {
                              return (
                                <Tooltip key={day.toISOString()}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`
                                        h-9 border-y-2 cursor-pointer transition-all hover:opacity-80
                                        ${row.colors.bg} ${row.colors.text}
                                        ${row.hasConflict ? 'border-destructive' : row.colors.border}
                                        ${isBarStart ? 'rounded-l-md border-l-2 pl-1.5' : ''}
                                        ${isBarEnd ? 'rounded-r-md border-r-2' : ''}
                                        flex items-center overflow-hidden
                                      `}
                                      onClick={() => handlePromoClick(row.promotion)}
                                    >
                                      {isBarStart && (
                                        <span className="text-[11px] font-medium truncate leading-tight">
                                          {row.hasConflict && '⚠️ '}
                                          {row.title}
                                        </span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs z-50">
                                    <div className="space-y-1.5">
                                      <p className="font-semibold">{row.labName} — {row.title}</p>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px]">{row.category}</Badge>
                                        <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {format(row.startDate, 'dd MMM', { locale: es })} — {format(row.endDate, 'dd MMM yyyy', { locale: es })}
                                        {' '}({row.totalDays} días)
                                      </p>
                                      <div className="flex gap-3 text-xs">
                                        <span>Costo Est: <strong>{formatCurrency(row.estimatedCost)}</strong></span>
                                      </div>
                                      {row.hasConflict && (
                                        <p className="text-xs text-destructive font-medium">
                                          ⚠️ Conflicto con: {row.conflictWith.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }

                            return (
                              <div
                                key={day.toISOString()}
                                className={`h-9 ${isToday ? 'bg-primary/5' : ''}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Legend (mobile) */}
        <div className="lg:hidden">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leyenda de Categorías
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {allCategories.map(cat => {
                  const colors = getCategoryColor(cat, ganttItems.dynamicColorMap);
                  return (
                    <div key={cat} className="flex items-center gap-1.5">
                      <div className={`h-3 w-8 rounded-sm border ${colors.bg} ${colors.border}`} />
                      <span className="text-xs text-muted-foreground">{cat}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-8 rounded-sm border-2 border-destructive bg-destructive/10" />
                  <span className="text-xs text-destructive font-medium">Conflicto</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Sheet */}
      <PromotionDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        promotion={selectedPromo}
        mechanic={selectedPromo ? mechanics[selectedPromo.id]?.[0] : undefined}
        labName={selectedPromo?.laboratories?.name}
      />
    </div>
  );
};

export default Calendar;
