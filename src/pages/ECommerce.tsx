import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Filter,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";

import logo from "@/assets/logo.png";
import {
  checkoutEcommerce,
  createEcommerceSession,
  EcommerceCartItemInput,
  EcommerceCartQuote,
  EcommerceProduct,
  EcommerceSession,
  getEcommerceFilterOptions,
  getEcommerceProduct,
  getEcommerceProductsPage,
  listTotal,
  quoteEcommerceCart,
} from "@/lib/api";
import { formatApiErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const PAGE_SIZE = 24;
const SESSION_KEY = "ivanagro_ecommerce_session";
const CART_KEY = "ivanagro_ecommerce_cart";

function money(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function text(value: unknown, fallback = "N/A") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function loadStoredSession(): EcommerceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as EcommerceSession;
    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(CART_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function loadStoredCart(): EcommerceCartItemInput[] {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function ECommerce() {
  const [session, setSession] = useState<EcommerceSession | null>(() => loadStoredSession());
  const [nit, setNit] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [products, setProducts] = useState<EcommerceProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filters, setFilters] = useState({ brands: [] as string[], categories: [] as string[] });

  const [cart, setCart] = useState<EcommerceCartItemInput[]>(() => loadStoredCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [quote, setQuote] = useState<EcommerceCartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<EcommerceProduct | null>(null);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    delivery_address: "",
    payment_method: "",
    observations: "",
  });

  const token = session?.ecommerce_token ?? "";
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const sortParams = useMemo(() => {
    if (sort === "price_asc") return { sort_by: "price", sort_dir: "asc" as const };
    if (sort === "price_desc") return { sort_by: "price", sort_dir: "desc" as const };
    if (sort === "available_desc") return { sort_by: "available", sort_dir: "desc" as const };
    return { sort_by: "name", sort_dir: "asc" as const };
  }, [sort]);

  const fetchProducts = useCallback(async () => {
    if (!token) return;
    setLoadingProducts(true);
    setProductError(null);
    try {
      const response = await getEcommerceProductsPage(token, {
        search: search.trim() || undefined,
        brand_name: brand === "all" ? undefined : brand,
        category: category === "all" ? undefined : category,
        in_stock_only: inStockOnly || undefined,
        ...sortParams,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setProducts(response.data ?? []);
      setTotalProducts(listTotal(response));
    } catch (error) {
      setProductError(formatApiErrorMessage(error));
    } finally {
      setLoadingProducts(false);
    }
  }, [brand, category, inStockOnly, search, sortParams, token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void fetchProducts(), 250);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, token]);

  useEffect(() => {
    if (!token) return;
    getEcommerceFilterOptions(token)
      .then((data) => setFilters({ brands: data.brands ?? [], categories: data.categories ?? [] }))
      .catch(() => setFilters({ brands: [], categories: [] }));
  }, [token]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    if (!token || cart.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    quoteEcommerceCart(token, cart)
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cart, token]);

  const startSession = async (event: React.FormEvent) => {
    event.preventDefault();
    setSessionLoading(true);
    setSessionError(null);
    try {
      const next = await createEcommerceSession(nit.trim());
      setSession(next);
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setCheckoutForm((prev) => ({
        ...prev,
        contact_name: text(next.customer.name, ""),
        contact_phone: text(next.customer.phone, ""),
        contact_email: text(next.customer.email, ""),
        delivery_address: text(next.customer.address, ""),
      }));
    } catch (error) {
      setSessionError(formatApiErrorMessage(error));
    } finally {
      setSessionLoading(false);
    }
  };

  const resetSession = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CART_KEY);
    setSession(null);
    setCart([]);
    setQuote(null);
    setOrderReference(null);
  };

  const addToCart = (product: EcommerceProduct) => {
    if (!product.can_add_to_cart) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.sku === product.product_sku);
      if (existing) {
        return prev.map((item) => item.sku === product.product_sku ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { sku: product.product_sku, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const setQuantity = (sku: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.sku !== sku));
      return;
    }
    setCart((prev) => prev.map((item) => item.sku === sku ? { ...item, quantity } : item));
  };

  const openProduct = async (product: EcommerceProduct) => {
    setSelectedProduct(product);
    setProductDetailOpen(true);
    setDetailLoading(true);
    try {
      setSelectedProduct(await getEcommerceProduct(token, product.product_sku));
    } catch {
      setSelectedProduct(product);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitCheckout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const order = await checkoutEcommerce(token, {
        items: cart,
        contact_name: checkoutForm.contact_name,
        contact_phone: checkoutForm.contact_phone,
        contact_email: checkoutForm.contact_email || undefined,
        delivery_address: checkoutForm.delivery_address,
        payment_method: checkoutForm.payment_method || undefined,
        observations: checkoutForm.observations || undefined,
      });
      setOrderReference(order.reference);
      setCart([]);
      setQuote(null);
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (error) {
      setCheckoutError(formatApiErrorMessage(error));
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8">
          <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <section className="space-y-6">
              <img src={logo} alt="Ivanagro" className="h-16 w-auto object-contain dark:brightness-0 dark:invert" />
              <div className="space-y-3">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">E-commerce Ivanagro</Badge>
                <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Catalogo comercial con precios para tu negocio</h1>
                <p className="max-w-xl text-lg text-muted-foreground">
                  Ingresa el NIT o documento registrado para consultar productos, disponibilidad y tu lista de precios.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <AccessMetric label="Precios" value="Personalizados" />
                <AccessMetric label="Carrito" value="Persistente" />
                <AccessMetric label="Orden" value="Borrador" />
              </div>
            </section>

            <section className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold">Acceso de cliente</h2>
                  <p className="text-sm text-muted-foreground">No necesitas usuario del backoffice.</p>
                </div>
              </div>
              <form className="space-y-4" onSubmit={startSession}>
                <div className="space-y-2">
                  <Label htmlFor="nit">NIT / documento</Label>
                  <Input id="nit" value={nit} onChange={(event) => setNit(event.target.value)} placeholder="Ej: CN901235357" />
                </div>
                {sessionError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{sessionError}</div>}
                <Button type="submit" className="h-11 w-full gap-2" disabled={sessionLoading || nit.trim().length < 3}>
                  {sessionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Entrar al catalogo
                </Button>
              </form>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3">
          <img src={logo} alt="Ivanagro" className="h-10 w-auto object-contain dark:brightness-0 dark:invert" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{session.customer.name}</p>
            <p className="truncate text-xs text-muted-foreground">{session.customer.government_id}</p>
          </div>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={resetSession}>
            Cambiar cliente
          </Button>
          <Button className="relative gap-2" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            Carrito
            {cartCount > 0 && <span className="rounded bg-primary-foreground/20 px-1.5 text-xs">{cartCount}</span>}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold"><Store className="h-6 w-6 text-primary" /> E-commerce</h1>
              <p className="text-sm text-muted-foreground">Productos, disponibilidad y precios para {session.customer.name}.</p>
            </div>
            <p className="text-sm text-muted-foreground">{totalProducts === null ? products.length : totalProducts.toLocaleString("es-CO")} productos</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_13rem_12rem_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar SKU, producto, marca o categoria" className="pl-9" />
            </div>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {filters.brands.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorias</SelectItem>
                {filters.categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nombre A-Z</SelectItem>
                <SelectItem value="price_asc">Menor precio</SelectItem>
                <SelectItem value="price_desc">Mayor precio</SelectItem>
                <SelectItem value="available_desc">Mayor stock</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant={inStockOnly ? "default" : "outline"} className="gap-2" onClick={() => setInStockOnly((value) => !value)}>
              <Filter className="h-4 w-4" />
              Con stock
            </Button>
          </div>
        </section>

        {productError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{productError}</div>}

        {loadingProducts ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">No encontramos productos con estos filtros.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.product_sku} product={product} onOpen={() => openProduct(product)} onAdd={() => addToCart(product)} />
            ))}
          </div>
        )}
      </main>

      <Button
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full shadow-lg md:hidden"
        size="icon"
        onClick={() => setCartOpen(true)}
      >
        <ShoppingCart className="h-5 w-5" />
      </Button>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
          <div className="border-b px-4 pb-4 pt-5 sm:px-6">
            <SheetHeader>
              <SheetTitle>Carrito de compras</SheetTitle>
              <SheetDescription>{cartCount} unidades seleccionadas</SheetDescription>
            </SheetHeader>
          </div>
          <div className="space-y-4 px-4 py-4 sm:px-6">
            {cart.length === 0 ? (
              <div className="rounded-md border bg-muted/35 p-6 text-center text-sm text-muted-foreground">Tu carrito esta vacio.</div>
            ) : (
              <>
                {quoteLoading && <div className="text-sm text-muted-foreground">Recalculando precios...</div>}
                {quote?.errors && quote.errors.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {quote.errors.map((error) => <p key={`${error.sku}-${error.message}`}>{error.sku}: {error.message}</p>)}
                  </div>
                )}
                <div className="space-y-3">
                  {cart.map((item) => {
                    const quoted = quote?.items.find((entry) => entry.sku === item.sku);
                    return (
                      <div key={item.sku} className="rounded-md border bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{quoted?.product_name ?? item.sku}</p>
                            <p className="mt-1 text-xs text-muted-foreground">SKU: {item.sku}</p>
                            <p className="mt-2 font-bold">{quoted ? money(quoted.line_total) : "Pendiente"}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setQuantity(item.sku, 0)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(item.sku, item.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                          <span className="w-10 text-center font-semibold">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(item.sku, item.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-md border bg-muted/25 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-bold">{money(quote?.total ?? 0)}</span>
                  </div>
                  <Button className="mt-4 h-11 w-full" disabled={!quote || quote.errors.length > 0 || cart.length === 0} onClick={() => setCheckoutOpen(true)}>
                    Finalizar pedido
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={productDetailOpen} onOpenChange={setProductDetailOpen}>
        <DialogContent className="max-w-3xl">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{text(selectedProduct.product_commercial_name, "Producto sin nombre")}</DialogTitle>
                <DialogDescription>SKU: {selectedProduct.product_sku}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
                <div className="flex aspect-square items-center justify-center rounded-md border bg-muted/35">
                  {detailLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Package className="h-12 w-12 text-muted-foreground" />}
                </div>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Fact label="Marca" value={selectedProduct.product_brand_name} />
                    <Fact label="Categoria" value={selectedProduct.product_category} />
                    <Fact label="Disponible" value={Number(selectedProduct.total_units_available || 0).toLocaleString("es-CO")} />
                    <Fact label="Precio" value={selectedProduct.price === null || selectedProduct.price === undefined ? "Sin precio" : money(selectedProduct.price)} />
                  </div>
                  <div className="rounded-md border bg-card p-3">
                    <p className="text-xs font-medium text-muted-foreground">Descripcion</p>
                    <p className="mt-1 text-sm">{text(selectedProduct.product_technical_description, "Sin informacion disponible.")}</p>
                  </div>
                  <Button className="w-full" disabled={!selectedProduct.can_add_to_cart} onClick={() => addToCart(selectedProduct)}>
                    Agregar al carrito
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar pedido</DialogTitle>
            <DialogDescription>Validaremos precios y stock antes de crear la orden borrador.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitCheckout}>
            <Field label="Nombre contacto" value={checkoutForm.contact_name} onChange={(value) => setCheckoutForm((prev) => ({ ...prev, contact_name: value }))} required />
            <Field label="Celular" value={checkoutForm.contact_phone} onChange={(value) => setCheckoutForm((prev) => ({ ...prev, contact_phone: value }))} required />
            <Field label="Email" value={checkoutForm.contact_email} onChange={(value) => setCheckoutForm((prev) => ({ ...prev, contact_email: value }))} />
            <Field label="Direccion entrega" value={checkoutForm.delivery_address} onChange={(value) => setCheckoutForm((prev) => ({ ...prev, delivery_address: value }))} required />
            <Field label="Metodo de pago" value={checkoutForm.payment_method} onChange={(value) => setCheckoutForm((prev) => ({ ...prev, payment_method: value }))} />
            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea value={checkoutForm.observations} onChange={(event) => setCheckoutForm((prev) => ({ ...prev, observations: event.target.value }))} />
            </div>
            {checkoutError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{checkoutError}</div>}
            <Button type="submit" className="h-11 w-full gap-2" disabled={checkoutLoading}>
              {checkoutLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear orden borrador
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderReference} onOpenChange={(open) => !open && setOrderReference(null)}>
        <DialogContent>
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <DialogTitle>Orden recibida</DialogTitle>
            <DialogDescription>Tu pedido quedo como borrador para validacion comercial.</DialogDescription>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Referencia</p>
              <p className="text-xl font-bold">{orderReference}</p>
            </div>
            <Button className="w-full" onClick={() => setOrderReference(null)}>Seguir comprando</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function ProductCard({ product, onOpen, onAdd }: { product: EcommerceProduct; onOpen: () => void; onAdd: () => void }) {
  const hasPrice = product.price !== null && product.price !== undefined;
  return (
    <article className="flex min-h-[16rem] flex-col rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex h-24 items-center justify-center rounded-md bg-muted/35">
        <Package className="h-9 w-9 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {product.product_category && <Badge variant="secondary">{product.product_category}</Badge>}
          {!hasPrice && <Badge variant="outline">Sin precio</Badge>}
        </div>
        <h2 className="line-clamp-2 font-semibold">{text(product.product_commercial_name, "Producto sin nombre")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">SKU: {product.product_sku}</p>
        <p className="mt-3 text-xl font-bold">{hasPrice ? money(product.price) : "Consultar precio"}</p>
        <p className="text-xs text-muted-foreground">Disponible: {Number(product.total_units_available || 0).toLocaleString("es-CO")}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onOpen}>Detalle</Button>
        <Button onClick={onAdd} disabled={!product.can_add_to_cart}>Agregar</Button>
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-h-[4rem] rounded-md bg-muted/35 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{text(value)}</p>
    </div>
  );
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}
