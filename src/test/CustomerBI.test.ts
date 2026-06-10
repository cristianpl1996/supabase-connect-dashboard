import { describe, expect, it } from "vitest";

import { addMonths, periodDelta, productShareData } from "@/lib/customerBI";
import type { CustomerBIProduct } from "@/lib/api";

function product(name: string, revenue: number, units: number): CustomerBIProduct {
  return {
    product_sku: name,
    product_commercial_name: name,
    product_brand_name: null,
    total_units: units,
    total_revenue: revenue,
    purchase_count: 1,
    last_purchase_date: null,
  };
}

describe("Customer BI helpers", () => {
  it("moves month ranges across year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-11", 3)).toBe("2026-02");
  });

  it("calculates period variation including an empty previous period", () => {
    expect(periodDelta(150, 100)).toBe(0.5);
    expect(periodDelta(100, 0)).toBe(1);
    expect(periodDelta(0, 0)).toBe(0);
  });

  it("groups lower-ranked products as Otros and preserves participation", () => {
    const products = [
      product("A", 50, 5),
      product("B", 20, 4),
      product("C", 10, 3),
      product("D", 8, 2),
      product("E", 7, 2),
      product("F", 5, 1),
    ];

    const shares = productShareData(products, "revenue");

    expect(shares).toHaveLength(6);
    expect(shares.at(-1)).toMatchObject({ name: "Otros", value: 5 });
    expect(shares.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1);
  });
});
