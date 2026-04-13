import { useCallback, useMemo, useState } from "react";
import { buildRepColorMap, parseCustomers, uniqueSorted } from "@/utils/mapUtils";
import type { Customer, CustomerFilters, ParseResult } from "@/types/map";

export const DEFAULT_FILTERS: CustomerFilters = {
  search: "",
  sales_rep_ids: [],
  coverage_area: "",
  business_type: "",
  min_ltv: "",
  max_ltv: "",
  min_ticket: "",
  max_ticket: "",
  min_days_since_purchase: "",
  max_days_since_purchase: "",
};

export interface SalesRepOption {
  id: string;
  name: string;
  coverageArea: string;
  color: string;
}

export interface UseMapLocationsReturn {
  filters: CustomerFilters;
  setFilter: <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => void;
  resetFilters: () => void;
  filteredCustomers: Customer[];
  allCustomers: Customer[];
  activeFilterCount: number;
  repColorMap: Map<string, string>;
  options: {
    salesReps: SalesRepOption[];
    coverageAreas: string[];
    businessTypes: string[];
  };
  parseResult: ParseResult;
}

export function useMapLocations(rawData: unknown[]): UseMapLocationsReturn {
  const [filters, setFilters] = useState<CustomerFilters>(DEFAULT_FILTERS);

  const parseResult = useMemo(() => parseCustomers(rawData), [rawData]);
  const allCustomers = parseResult.valid;

  const repColorMap = useMemo(() => buildRepColorMap(allCustomers), [allCustomers]);

  const options = useMemo(() => {
    const repMap = new Map<string, SalesRepOption>();
    for (const c of allCustomers) {
      const id = String(c.sales_representative_id);
      if (!repMap.has(id)) {
        repMap.set(id, {
          id,
          name: c.sales_rep_full_name,
          coverageArea: c.sales_rep_coverage_area,
          color: repColorMap.get(c.sales_rep_full_name) ?? "#666",
        });
      }
    }
    const salesReps = [...repMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es")
    );
    return {
      salesReps,
      coverageAreas: uniqueSorted(allCustomers.map((c) => c.sales_rep_coverage_area)),
      businessTypes: uniqueSorted(allCustomers.map((c) => c.customer_business_type)),
    };
  }, [allCustomers, repColorMap]);

  const filteredCustomers = useMemo(() => {
    const {
      search, sales_rep_ids, coverage_area, business_type,
      min_ltv, max_ltv, min_ticket, max_ticket,
      min_days_since_purchase, max_days_since_purchase,
    } = filters;

    const q = search.toLowerCase().trim();
    const minLtv = min_ltv !== "" ? Number(min_ltv) : null;
    const maxLtv = max_ltv !== "" ? Number(max_ltv) : null;
    const minTicket = min_ticket !== "" ? Number(min_ticket) : null;
    const maxTicket = max_ticket !== "" ? Number(max_ticket) : null;
    const minDays = min_days_since_purchase !== "" ? Number(min_days_since_purchase) : null;
    const maxDays = max_days_since_purchase !== "" ? Number(max_days_since_purchase) : null;

    return allCustomers.filter((c) => {
      // Multi-rep filter
      if (sales_rep_ids.length > 0 && !sales_rep_ids.includes(String(c.sales_representative_id))) return false;
      if (coverage_area && c.sales_rep_coverage_area !== coverage_area) return false;
      if (business_type && c.customer_business_type !== business_type) return false;

      if (q &&
        !c.customer_full_name.toLowerCase().includes(q) &&
        !c.customer_government_id.toLowerCase().includes(q) &&
        !c.customer_business_address.toLowerCase().includes(q)
      ) return false;

      if (minLtv !== null && c.customer_total_lifetime_revenue < minLtv) return false;
      if (maxLtv !== null && c.customer_total_lifetime_revenue > maxLtv) return false;
      if (minTicket !== null && c.customer_average_purchase_ticket_amount < minTicket) return false;
      if (maxTicket !== null && c.customer_average_purchase_ticket_amount > maxTicket) return false;
      if (minDays !== null && c.customer_days_since_last_purchase < minDays) return false;
      if (maxDays !== null && c.customer_days_since_last_purchase > maxDays) return false;

      return true;
    });
  }, [allCustomers, filters]);

  const setFilter = useCallback(
    <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    []
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeFilterCount = useMemo(
    () => (Object.keys(filters) as (keyof CustomerFilters)[])
      .filter((k) => {
        const v = filters[k];
        const d = DEFAULT_FILTERS[k];
        if (Array.isArray(v) && Array.isArray(d)) return v.length !== d.length;
        return v !== d;
      }).length,
    [filters]
  );

  return {
    filters, setFilter, resetFilters,
    filteredCustomers, allCustomers,
    activeFilterCount, repColorMap, options, parseResult,
  };
}
