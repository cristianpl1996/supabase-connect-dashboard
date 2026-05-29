import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Promotions from "@/pages/Promotions";
import type { Promotion } from "@/types/database";

const api = vi.hoisted(() => ({
  clonePromotion: vi.fn(),
  deletePromotion: vi.fn(),
  listLaboratories: vi.fn(),
  listPromotions: vi.fn(),
  updatePromotionStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const samplePromotion: Promotion = {
  id: "promo-1",
  lab_id: "lab-1",
  laboratory_name: "Laboratorio Uno",
  created_by_role: "admin",
  title: "Promo duplicable",
  description: null,
  start_date: "2026-05-28",
  end_date: "2026-05-30",
  status: "borrador",
  estimated_cost: 0,
  max_redemptions: null,
  current_redemptions: 0,
  flash_card_url: null,
  marketing_copy: null,
  created_at: "2026-05-28T00:00:00Z",
  mechanic: {
    promotion_type: "descuento_linea",
  },
};

describe("Promotions clone confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listPromotions.mockResolvedValue([samplePromotion]);
    api.listLaboratories.mockResolvedValue([]);
    api.clonePromotion.mockResolvedValue({ ...samplePromotion, id: "promo-2" });
  });

  it("asks for confirmation before duplicating a promotion", async () => {
    render(<Promotions />);

    await screen.findAllByText("Promo duplicable");

    fireEvent.click(screen.getAllByTitle("Duplicar promocion")[0]);

    expect(api.clonePromotion).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/duplicar la promocion "Promo duplicable"/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));

    await waitFor(() => expect(api.clonePromotion).toHaveBeenCalledWith("promo-1"));
  });
});
