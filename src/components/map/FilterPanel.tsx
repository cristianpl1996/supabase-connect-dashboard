import { useState } from "react";
import type React from "react";
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
  X,
  Check,
  MapPin,
  Store,
  Clock,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SalesRepOption } from "@/hooks/useMapLocations";
import type { CustomerFilters } from "@/types/map";

interface FilterPanelProps {
  filters: CustomerFilters;
  options: {
    salesReps: SalesRepOption[];
    coverageAreas: string[];
    businessTypes: string[];
  };
  totalCount: number;
  filteredCount: number;
  activeFilterCount: number;
  onFilter: <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => void;
  onReset: () => void;
  onZoomToAll: () => void;
}


// ─── Inline search box ────────────────────────────────────────────────────────

function PopoverSearch({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="px-2 py-2 border-b border-gray-100">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          autoFocus
          className="w-full h-7 pl-7 pr-2 text-xs rounded-md border border-gray-200 bg-white outline-none focus:border-primary transition-colors"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Multi-select rep picker ──────────────────────────────────────────────────

function RepMultiSelect({
  salesReps,
  selectedIds,
  onChange,
  triggerClassName,
}: {
  salesReps: SalesRepOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
    );
  };

  const label =
    selectedIds.length === 0
      ? "Representantes"
      : selectedIds.length === 1
      ? salesReps.find((r) => r.id === selectedIds[0])?.name ?? "1 representante"
      : `${selectedIds.length} representantes`;

  const filtered = salesReps.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={triggerClassName ?? "h-8 min-w-[200px] justify-between text-sm font-normal px-3"}
        >
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            {selectedIds.length > 0 && (
              <div className="flex -space-x-1 shrink-0">
                {selectedIds.slice(0, 3).map((id) => {
                  const rep = salesReps.find((r) => r.id === id);
                  return rep ? (
                    <span
                      key={id}
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-white"
                      style={{ backgroundColor: rep.color }}
                    />
                  ) : null;
                })}
              </div>
            )}
            <span className="truncate text-gray-700">{label}</span>
          </div>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start" sideOffset={4}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-600">Representantes</span>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>

        {/* Search */}
        <PopoverSearch value={search} onChange={setSearch} placeholder="Buscar representante…" />

        {/* Rep list */}
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</p>
          )}
          {filtered.map((rep) => {
            const checked = selectedIds.includes(rep.id);
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => toggle(rep.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
              >
                <Checkbox
                  checked={checked}
                  className="pointer-events-none h-3.5 w-3.5 shrink-0"
                  style={checked ? { backgroundColor: rep.color, borderColor: rep.color } : {}}
                />
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: rep.color }}
                />
                <span className="flex-1 truncate text-[12px] text-gray-700 leading-tight">
                  {rep.name}
                </span>
                {checked && <Check className="h-3 w-3 shrink-0" style={{ color: rep.color }} />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60">
          <p className="text-[10px] text-gray-400">
            {selectedIds.length === 0
              ? `${salesReps.length} representantes disponibles`
              : `${selectedIds.length} de ${salesReps.length} seleccionados`}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Single-select with search (zones / business types) ───────────────────────

function SearchableSelect({
  options,
  value,
  allLabel,
  placeholder,
  icon: Icon,
  onChange,
  triggerClassName,
}: {
  options: string[];
  value: string;
  allLabel: string;
  placeholder: string;
  icon: React.ElementType;
  onChange: (v: string) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  const active = !!value;
  const label = value || allLabel;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={triggerClassName ?? "h-8 w-[175px] justify-between text-sm font-normal px-3"}
        >
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-gray-400"}`} />
            <span className={`truncate ${active ? "text-gray-900 font-medium" : "text-gray-600"}`}>{label}</span>
          </div>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-60 p-0" align="start" sideOffset={4}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-600">{placeholder}</span>
          {active && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="h-3 w-3" /> Limpiar
            </button>
          )}
        </div>

        {/* Search */}
        <PopoverSearch value={search} onChange={setSearch} placeholder={`Buscar ${placeholder.toLowerCase()}…`} />

        {/* Options */}
        <div className="max-h-56 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => { onChange(""); setSearch(""); setOpen(false); }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-colors ${!active ? "font-semibold text-gray-900" : "text-gray-600"}`}
          >
            <span className="flex-1">{allLabel}</span>
            {!active && <Check className="h-3 w-3 text-primary shrink-0" />}
          </button>

          {filtered.length === 0 && (
            <p className="px-3 py-3 text-xs text-gray-400 text-center">Sin resultados</p>
          )}
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setSearch(""); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-colors ${value === o ? "font-semibold text-gray-900" : "text-gray-600"}`}
            >
              <span className="flex-1 truncate">{o}</span>
              {value === o && <Check className="h-3 w-3 text-primary shrink-0" />}
            </button>
          ))}
        </div>

        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/60">
          <p className="text-[10px] text-gray-400">
            {!active ? `${options.length} opciones disponibles` : `Filtrando: ${value}`}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Range inputs ─────────────────────────────────────────────────────────────

function RangeInputs({
  label,
  icon: Icon,
  minKey,
  maxKey,
  minValue,
  maxValue,
  placeholder,
  step = 1,
  onFilter,
}: {
  label: string;
  icon: React.ElementType;
  minKey: keyof CustomerFilters;
  maxKey: keyof CustomerFilters;
  minValue: string;
  maxValue: string;
  placeholder: { min: string; max: string };
  step?: number;
  onFilter: <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          className="h-8 text-sm"
          placeholder={placeholder.min}
          value={minValue}
          step={step}
          min={0}
          onChange={(e) => onFilter(minKey, e.target.value as CustomerFilters[typeof minKey])}
        />
        <span className="text-gray-300 text-xs shrink-0">—</span>
        <Input
          type="number"
          className="h-8 text-sm"
          placeholder={placeholder.max}
          value={maxValue}
          step={step}
          min={0}
          onChange={(e) => onFilter(maxKey, e.target.value as CustomerFilters[typeof maxKey])}
        />
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function FilterPanel({
  filters,
  options,
  totalCount,
  filteredCount,
  activeFilterCount,
  onFilter,
  onReset,
  onZoomToAll,
}: FilterPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 bg-white">

      {/* ── Single compact row ── */}
      <div className="flex items-center gap-2 px-3 py-2">

        {/* Search — toma todo el espacio sobrante */}
        <div className="relative flex-1 min-w-[140px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            className="pl-8 pr-7 h-8 text-sm"
            placeholder="Nombre, NIT, dirección…"
            value={filters.search}
            onChange={(e) => onFilter("search", e.target.value)}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilter("search", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Tres filtros: mismo ancho fijo para simetría */}
        <RepMultiSelect
          salesReps={options.salesReps}
          selectedIds={filters.sales_rep_ids}
          onChange={(ids) => onFilter("sales_rep_ids", ids)}
          triggerClassName="h-8 w-[195px] shrink-0 justify-between text-sm font-normal px-3"
        />
        <SearchableSelect
          options={options.coverageAreas}
          value={filters.coverage_area}
          allLabel="Zonas"
          placeholder="Zonas"
          icon={MapPin}
          onChange={(v) => onFilter("coverage_area", v)}
          triggerClassName="h-8 w-[155px] shrink-0 justify-between text-sm font-normal px-3"
        />
        <SearchableSelect
          options={options.businessTypes}
          value={filters.business_type}
          allLabel="Negocios"
          placeholder="Negocios"
          icon={Store}
          onChange={(v) => onFilter("business_type", v)}
          triggerClassName="h-8 w-[168px] shrink-0 justify-between text-sm font-normal px-3"
        />

        {/* Advanced toggle */}
        <Button
          variant={advancedOpen ? "default" : "outline"}
          size="sm"
          className="h-8 gap-1 text-sm px-2.5 shrink-0"
          onClick={() => setAdvancedOpen((o) => !o)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {activeFilterCount > 0 && (
            <Badge className="h-4 min-w-[16px] px-1 text-[10px]">{activeFilterCount}</Badge>
          )}
          {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {/* Reset */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 px-2 text-gray-500 shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Zoom */}
        <Button variant="outline" size="sm" onClick={onZoomToAll} className="h-8 gap-1.5 text-sm shrink-0">
          <Maximize2 className="h-3.5 w-3.5" />
          Ver todos
        </Button>
      </div>

      {/* ── Advanced (ranges only) ── */}
      {advancedOpen && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <RangeInputs
              label="Días sin comprar"
              icon={Clock}
              minKey="min_days_since_purchase"
              maxKey="max_days_since_purchase"
              minValue={filters.min_days_since_purchase}
              maxValue={filters.max_days_since_purchase}
              placeholder={{ min: "Mín días", max: "Máx días" }}
              onFilter={onFilter}
            />
            <RangeInputs
              label="LTV — facturación total"
              icon={TrendingUp}
              minKey="min_ltv"
              maxKey="max_ltv"
              minValue={filters.min_ltv}
              maxValue={filters.max_ltv}
              placeholder={{ min: "Mín $", max: "Máx $" }}
              step={10000}
              onFilter={onFilter}
            />
            <RangeInputs
              label="Ticket promedio"
              icon={ShoppingBag}
              minKey="min_ticket"
              maxKey="max_ticket"
              minValue={filters.min_ticket}
              maxValue={filters.max_ticket}
              placeholder={{ min: "Mín $", max: "Máx $" }}
              step={10000}
              onFilter={onFilter}
            />
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="flex items-center gap-3 px-3 py-1 bg-gray-50/80 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-800">{filteredCount}</span>
          {activeFilterCount > 0 && <span> de {totalCount}</span>}
          <span> {filteredCount === 1 ? "cliente" : "clientes"}</span>
        </p>

        {/* Active rep chips */}
        {filters.sales_rep_ids.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {filters.sales_rep_ids.slice(0, 4).map((id) => {
              const rep = options.salesReps.find((r) => r.id === id);
              if (!rep) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-white text-[10px] font-medium"
                  style={{ backgroundColor: rep.color }}
                >
                  {rep.name.split(" ")[0]}
                  <button
                    type="button"
                    onClick={() => onFilter("sales_rep_ids", filters.sales_rep_ids.filter((s) => s !== id))}
                    className="opacity-80 hover:opacity-100"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
            {filters.sales_rep_ids.length > 4 && (
              <span className="text-[10px] text-gray-400">+{filters.sales_rep_ids.length - 4} más</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
