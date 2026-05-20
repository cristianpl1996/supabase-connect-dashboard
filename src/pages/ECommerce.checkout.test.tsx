import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckoutDialog, type CheckoutFormState } from "./ECommerce";
import type { EcommerceCartQuote } from "@/lib/api";

const form: CheckoutFormState = {
  contact_name: "Eduardo Londono Buritica",
  contact_phone: "3206278087",
  contact_email: "eduardo@example.com",
  delivery_address: "CLL 37 NRO 58-54",
  delivery_latitude: null,
  delivery_longitude: null,
  payment_method: "PSE",
  observations: "",
};

const quote: EcommerceCartQuote = {
  items: [
    {
      line_number: 1,
      sku: "06-22-76-0070",
      product_name: "ACALMA DOGS SPRAY X 60 ML",
      quantity: 1,
      unit_price: 87750,
      line_total: 87750,
      available: 10,
      can_add_to_cart: true,
    },
  ],
  subtotal: 87750,
  total: 87750,
  errors: [],
};

describe("CheckoutDialog", () => {
  it("presents a professional checkout with order summary and structured sections", () => {
    const onChange = vi.fn();

    render(
      <CheckoutDialog
        open
        form={form}
        quote={quote}
        cartCount={1}
        checkoutLoading={false}
        checkoutError={null}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onSubmit={vi.fn((event) => event.preventDefault())}
      />,
    );

    expect(screen.getByRole("heading", { name: /finalizar pedido/i })).toBeInTheDocument();
    expect(screen.getByText(/1 producto listo para validar/i)).toBeInTheDocument();
    expect(screen.getByText(/resumen del pedido/i)).toBeInTheDocument();
    expect(screen.getByText("ACALMA DOGS SPRAY X 60 ML")).toBeInTheDocument();
    expect(screen.getAllByText(/\$\s*87\.750/).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Eduardo Londono Buritica")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3206278087")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CLL 37 NRO 58-54")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /datos de contacto/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^entrega$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pago y observaciones/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Notas adicionales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar orden/i })).toBeEnabled();
  });

  it("keeps submit disabled until required checkout data is complete", () => {
    render(
      <CheckoutDialog
        open
        form={{ ...form, payment_method: "" }}
        quote={quote}
        cartCount={1}
        checkoutLoading={false}
        checkoutError={null}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onSubmit={vi.fn((event) => event.preventDefault())}
      />,
    );

    expect(screen.getByRole("button", { name: /enviar orden/i })).toBeDisabled();
  });

  it("updates payment method through a controlled professional selector", () => {
    const onChange = vi.fn();

    render(
      <CheckoutDialog
        open
        form={{ ...form, payment_method: "" }}
        quote={quote}
        cartCount={1}
        checkoutLoading={false}
        checkoutError={null}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onSubmit={vi.fn((event) => event.preventDefault())}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: /metodo de pago/i }));
    fireEvent.click(screen.getByRole("option", { name: /pse/i }));

    expect(onChange).toHaveBeenCalledWith("payment_method", "PSE");
  });

  it("captures georeference from the map location action", () => {
    const onChange = vi.fn();
    const geolocation = {
      getCurrentPosition: vi.fn((success: PositionCallback) => success({
        coords: { latitude: 4.711, longitude: -74.0721 },
      } as GeolocationPosition)),
    };
    vi.stubGlobal("navigator", { ...navigator, geolocation });

    render(
      <CheckoutDialog
        open
        form={form}
        quote={quote}
        cartCount={1}
        checkoutLoading={false}
        checkoutError={null}
        onOpenChange={vi.fn()}
        onChange={onChange}
        onSubmit={vi.fn((event) => event.preventDefault())}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /marcar direccion en el mapa/i }));
    fireEvent.click(screen.getByRole("button", { name: /usar mi ubicacion actual/i }));

    expect(onChange).toHaveBeenCalledWith("delivery_latitude", 4.711);
    expect(onChange).toHaveBeenCalledWith("delivery_longitude", -74.0721);
  });
});
