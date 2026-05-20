import { describe, expect, it } from "vitest";
import { filterEcommerceOrders, getEcommerceOrderStateLabel, getItemCountLabel } from "./ecommerceOrderUtils";
import type { EcommerceMyOrder } from "@/lib/api";

function order(overrides: Partial<EcommerceMyOrder>): EcommerceMyOrder {
  return {
    id: "1",
    reference: "EC-1",
    status: "draft",
    subtotal: 100,
    total: 100,
    items_count: 1,
    items: [],
    created_at: "2026-05-19T10:00:00Z",
    ...overrides,
  };
}

describe("ecommerce order history helpers", () => {
  it("shows customer-facing open and closed states", () => {
    expect(getEcommerceOrderStateLabel("draft")).toBe("Abierto");
    expect(getEcommerceOrderStateLabel("submitted")).toBe("Abierto");
    expect(getEcommerceOrderStateLabel("cancelled")).toBe("Cerrado");
  });

  it("uses item copy instead of product copy", () => {
    expect(getItemCountLabel(1)).toBe("1 item");
    expect(getItemCountLabel(3)).toBe("3 items");
  });

  it("filters orders by open state and exact date", () => {
    const orders = [
      order({ id: "open", status: "draft", created_at: "2026-05-19T10:00:00Z" }),
      order({ id: "closed", status: "cancelled", created_at: "2026-05-19T11:00:00Z" }),
      order({ id: "other-date", status: "draft", created_at: "2026-05-18T10:00:00Z" }),
    ];

    expect(filterEcommerceOrders(orders, { state: "open", date: "2026-05-19" }).map((item) => item.id)).toEqual(["open"]);
    expect(filterEcommerceOrders(orders, { state: "closed", date: "2026-05-19" }).map((item) => item.id)).toEqual(["closed"]);
  });
});
