import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowUp,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Filter,
  LogOut,
  Loader2,
  LockKeyhole,
  Mail,
  Moon,
  Minus,
  Package,
  Plus,
  ScanLine,
  Search,
  SearchX,
  ShoppingCart,
  Sparkles,
  Store,
  Sun,
  Tags,
  Truck,
  Trash2,
  UserRound,
  AlertCircle,
  ArrowDownAZ,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import logoFull from "@/assets/logoico.png";
import bgImage from "@/assets/background.png";
import bgImage2 from "@/assets/background2.png";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 48;
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

function initials(value: unknown) {
  const clean = text(value, "Cliente").trim();
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
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

const ECOMMERCE_THEME_KEY = "ecommerce-theme";

export default function ECommerce() {
  const { resolvedTheme, setTheme } = useTheme();
  const [session, setSession] = useState<EcommerceSession | null>(() => loadStoredSession());
  const [nit, setNit] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [products, setProducts] = useState<EcommerceProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [withPriceOnly, setWithPriceOnly] = useState(false);
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
  const isDarkTheme = resolvedTheme === "dark";

  // Login screen always light; restore user preference when session is active
  useEffect(() => {
    if (!session) {
      setTheme("light");
    } else {
      const saved = localStorage.getItem(ECOMMERCE_THEME_KEY);
      if (saved) setTheme(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  const brandOptions = useMemo(
    () => filters.brands.map((item) => String(item ?? "").trim()).filter(Boolean),
    [filters.brands],
  );
  const categoryOptions = useMemo(
    () => filters.categories.map((item) => String(item ?? "").trim()).filter(Boolean),
    [filters.categories],
  );

  const sortParams = useMemo(() => {
    if (sort === "price_asc") return { sort_by: "price", sort_dir: "asc" as const };
    if (sort === "price_desc") return { sort_by: "price", sort_dir: "desc" as const };
    if (sort === "available_desc") return { sort_by: "available", sort_dir: "desc" as const };
    return { sort_by: "name", sort_dir: "asc" as const };
  }, [sort]);

  const fetchProducts = useCallback(async (offset = 0, append = false) => {
    if (!token) return;
    if (append) {
      setLoadingMoreProducts(true);
    } else {
      setLoadingProducts(true);
    }
    setProductError(null);
    try {
      const response = await getEcommerceProductsPage(token, {
        search: search.trim() || undefined,
        brand_name: brand === "all" ? undefined : brand,
        category: category === "all" ? undefined : category,
        in_stock_only: inStockOnly || undefined,
        with_price_only: withPriceOnly || undefined,
        ...sortParams,
        limit: PAGE_SIZE,
        offset,
      });
      const nextProducts = response.data ?? [];
      setProducts((prev) => append ? [...prev, ...nextProducts] : nextProducts);
      setTotalProducts(listTotal(response));
    } catch (error) {
      setProductError(formatApiErrorMessage(error));
    } finally {
      if (append) {
        setLoadingMoreProducts(false);
      } else {
        setLoadingProducts(false);
      }
    }
  }, [brand, category, inStockOnly, withPriceOnly, search, sortParams, token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void fetchProducts(0, false), 250);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, token]);

  useEffect(() => {
    if (!token) return;
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const viewportBottom = window.innerHeight + scrollY;
      setShowBackToTop(scrollY > 520);

      const hasMore = totalProducts === null || products.length < totalProducts;
      if (
        hasMore &&
        products.length > 0 &&
        !loadingProducts &&
        !loadingMoreProducts &&
        viewportBottom >= documentHeight - 720
      ) {
        void fetchProducts(products.length, true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchProducts, loadingMoreProducts, loadingProducts, products.length, token, totalProducts]);

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
      toast.success("Cliente validado correctamente", {
        description: `Bienvenido al e-commerce, ${text(next.customer.name, "cliente")}.`,
        duration: 3000,
      });
    } catch (error) {
      setSessionError(formatApiErrorMessage(error));
    } finally {
      setSessionLoading(false);
    }
  };

  const resetSession = () => {
    setTheme("light");
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
    const entranceBackground = bgImage2 || bgImage;

    return (
      <div className="min-h-screen overflow-hidden bg-[#f5f8f6] text-foreground dark:bg-background">
        <style>{`
          @keyframes ecommerce-float-slow { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.03)} }
          @keyframes ecommerce-drift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(18px)} }
          @keyframes ecommerce-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes ecommerce-pulse { 0%,100%{opacity:.24} 50%{opacity:.44} }
        `}</style>
        <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid w-full gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
            <section
              className="relative overflow-hidden rounded-lg border border-emerald-900/15 bg-emerald-950 p-5 text-white shadow-[0_28px_80px_-48px_rgba(0,80,45,.9)] sm:p-7 lg:min-h-[33rem]"
              style={{
                backgroundImage: `url(${entranceBackground})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(2,44,34,.88)_0%,rgba(7,98,55,.72)_44%,rgba(0,0,0,.82)_100%)]" />
              <div
                className="absolute inset-0 opacity-[0.09]"
                style={{
                  backgroundImage: "radial-gradient(circle, white 1.4px, transparent 1.4px)",
                  backgroundSize: "34px 34px",
                }}
              />
              <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-300/24 blur-3xl motion-safe:animate-[ecommerce-float-slow_9s_ease-in-out_infinite]" />
              <div className="absolute -right-24 top-1/4 h-80 w-80 rounded-full bg-green-200/20 blur-3xl motion-safe:animate-[ecommerce-float-slow_7s_ease-in-out_infinite,ecommerce-drift_11s_ease-in-out_infinite]" />
              <div className="absolute left-1/4 top-1/2 h-56 w-56 rounded-full bg-lime-200/14 blur-3xl motion-safe:animate-[ecommerce-float-slow_8s_ease-in-out_infinite]" />
              <div className="absolute bottom-2 right-1/3 h-64 w-64 rounded-full bg-emerald-100/12 blur-3xl motion-safe:animate-[ecommerce-drift_12s_ease-in-out_infinite]" />
              <div className="absolute bottom-10 right-14 h-28 w-28 rounded-full border border-white/20 motion-safe:animate-[ecommerce-spin_20s_linear_infinite]" />
              <div className="absolute bottom-16 left-8 h-3 w-3 rounded-full bg-white/70 shadow-[0_0_18px_rgba(255,255,255,.8)] motion-safe:animate-[ecommerce-pulse_5s_ease-in-out_infinite]" />
              <div className="absolute left-[56%] top-20 h-2 w-2 rounded-full bg-white/60 shadow-[0_0_14px_rgba(255,255,255,.7)] motion-safe:animate-[ecommerce-float-slow_6s_ease-in-out_infinite]" />
              <div className="absolute left-[82%] top-[58%] h-2.5 w-2.5 rounded-full bg-emerald-100/80 shadow-[0_0_22px_rgba(209,250,229,.9)] motion-safe:animate-[ecommerce-pulse_4s_ease-in-out_infinite]" />
              <div className="absolute left-[43%] top-[34%] h-2 w-2 rounded-full bg-white/70 shadow-[0_0_18px_rgba(255,255,255,.8)] motion-safe:animate-[ecommerce-float-slow_7s_ease-in-out_infinite]" />
              <div className="relative flex flex-col gap-7">
                <div className="flex items-center justify-between gap-4">
                  <img src={logoFull} alt="Ivanagro" className="h-11 w-auto object-contain brightness-0 invert drop-shadow-[0_10px_24px_rgba(0,0,0,.22)] sm:h-12" />
                  <Badge className="gap-1 border-white/15 bg-white/14 text-white hover:bg-white/14">
                    <Sparkles className="h-3.5 w-3.5" />
                    Portal comercial
                  </Badge>
                </div>

                <div className="max-w-3xl space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">E-commerce</p>
                  <h1 className="max-w-2xl text-2xl font-bold leading-[1.12] tracking-tight sm:text-3xl lg:text-4xl">
                    Compra con precios negociados para tu negocio
                  </h1>
                  <p className="max-w-xl text-sm leading-6 text-white/78 sm:text-base">
                    Ingresa con tu NIT o documento registrado para consultar catalogo, disponibilidad real y precios asignados a tu cuenta comercial.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <AccessMetric icon={Tags} label="Lista de precios" value="Personalizada" />
                  <AccessMetric icon={Package} label="Inventario" value="Disponible" />
                  <AccessMetric icon={Truck} label="Pedido" value="Borrador" />
                </div>

                <div className="grid gap-3 rounded-lg border border-white/12 bg-white/10 p-3 backdrop-blur-sm sm:grid-cols-3">
                  <AccessSignal icon={BadgeCheck} label="Cliente validado" />
                  <AccessSignal icon={LockKeyhole} label="Sesion temporal" />
                  <AccessSignal icon={ShoppingCart} label="Carrito persistente" />
                </div>
              </div>
            </section>

            <section className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-[0_24px_70px_-48px_rgba(0,0,0,.6)]">
              <div className="flex flex-1 flex-col justify-center bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),transparent_55%)] p-5 sm:p-7">
                <div className="mb-6 space-y-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[linear-gradient(135deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.08))] text-primary shadow-[0_16px_36px_-24px_hsl(var(--primary))] ring-1 ring-primary/15">
                    <UserRound className="h-7 w-7" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Acceso de cliente</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Valida tu cuenta comercial y entra al catalogo con precios personalizados.
                    </p>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={startSession}>
                  <div className="space-y-2">
                    <Label htmlFor="nit">NIT / documento</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <ScanLine className="h-4.5 w-4.5" />
                      </span>
                      <Input
                        id="nit"
                        value={nit}
                        onChange={(event) => setNit(event.target.value)}
                        placeholder="Ej: CN901235357"
                        className="h-12 bg-background pl-12 text-base shadow-sm"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {sessionError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{sessionError}</div>}
                  <Button type="submit" className="h-12 w-full gap-2 text-sm font-bold shadow-[0_18px_42px_-28px_hsl(var(--primary))]" disabled={sessionLoading || nit.trim().length < 3}>
                    {sessionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
                    Entrar al e-commerce
                  </Button>
                </form>

                <div className="mt-6 grid gap-3 border-t pt-5 sm:grid-cols-2">
                  <AccessNote icon={Building2} title="Cuenta comercial" text="El acceso se asocia al cliente registrado en la plataforma." />
                  <AccessNote icon={Tags} title="Precios vigentes" text="Consulte siempre los mejores precios de los productos." />
                </div>
                <div className="mt-5 rounded-md border bg-background/75 p-3">
                  <p className="text-xs leading-5 text-muted-foreground flex items-center gap-2">

                    <AlertCircle className="h-10 w-10 text-primary" /> Si tu documento no abre el catalogo o necesitas activar precios, contacta a tu asesor comercial o a travez de nuestros canales de comunicación.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 h-9 w-full gap-2 bg-background">
                    <a href="mailto:comercial@ivanagro.com">
                      <Mail className="h-4 w-4" />
                      Contactanos
                    </a>
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background shadow-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 mb-1">
            <img src={logoFull} alt="Ivanagro" className="h-11 w-auto object-contain dark:brightness-0 dark:invert sm:h-12" />
          </div>

          <div
            className="flex h-9 items-center gap-2 rounded-full border border-border/60 bg-background/70 px-2 text-muted-foreground shadow-sm"
            title={isDarkTheme ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            <Sun
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                !isDarkTheme && "text-primary",
              )}
            />
            <Switch
              checked={isDarkTheme}
              onCheckedChange={() => {
                const next = isDarkTheme ? "light" : "dark";
                setTheme(next);
                localStorage.setItem(ECOMMERCE_THEME_KEY, next);
              }}
              aria-label="Cambiar tema"
              className="h-5 w-9 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=checked]:bg-emerald-500 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
            />
            <Moon
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                isDarkTheme && "text-primary",
              )}
            />
          </div>

          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground ring-2 ring-border/40 shadow-sm transition hover:bg-muted hover:text-foreground"
            title="Abrir carrito"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
                {cartCount}
              </span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Cuenta de cliente">
                <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-border/40 shadow-sm">
                  <AvatarFallback className="bg-primary/10 text-base font-bold text-primary">
                    {initials(session.customer.name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="space-y-1">
                  <p className="truncate text-sm font-semibold">{session.customer.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.customer.government_id || "Cliente"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={resetSession}>
                <LogOut className="h-4 w-4" />
                Cerrar sesion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="bg-[linear-gradient(135deg,hsl(var(--primary)/0.10),hsl(var(--primary)/0.025)_44%,transparent)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="flex items-center gap-2 text-xl font-bold sm:text-3xl"><Store className="h-6 w-6 text-primary" /> E-commerce</h1>
                <p className="text-sm text-muted-foreground ml-8 mt-1">Productos, disponibilidad, precios y promociones.</p>
              </div>
              <div className="w-fit rounded-full border bg-background/80 px-3 py-1 text-sm font-medium text-muted-foreground">
                {totalProducts === null ? products.length : totalProducts.toLocaleString("es-CO")} productos
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem_11rem_auto]">
            <div className="relative h-full">
              <button type="button" onClick={() => setSearch(searchInput.trim())} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
                <Search className="h-4 w-4" />
              </button>
              <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput.trim())} placeholder="Buscar SKU, producto, marca o categoria" className="h-11 bg-background pl-9 pr-9" />
              {search && (
                <button type="button" onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {brandOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorias</SelectItem>
                {categoryOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-11 w-full lg:w-44 bg-background">
                <div className="flex items-center gap-2">
                  <ArrowDownAZ className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar por" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nombre A-Z</SelectItem>
                <SelectItem value="price_asc">Menor precio</SelectItem>
                <SelectItem value="price_desc">Mayor precio</SelectItem>
                <SelectItem value="available_desc">Mayor stock</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button type="button" variant={inStockOnly ? "default" : "outline"} className={cn("h-11 flex-1 gap-2", !inStockOnly && "bg-background")} onClick={() => setInStockOnly((value) => !value)}>
                <Filter className="h-4 w-4" />
                Con stock
              </Button>
              <Button type="button" variant={withPriceOnly ? "default" : "outline"} className={cn("h-11 flex-1 gap-2", !withPriceOnly && "bg-background")} onClick={() => setWithPriceOnly((value) => !value)}>
                <Filter className="h-4 w-4" />
                Con precio
              </Button>
            </div>
          </div>
          {(search || brand !== "all" || category !== "all" || inStockOnly || withPriceOnly) && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-4 sm:px-5">
              {search && (
                <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15">
                  <span className="truncate">Búsqueda: {search}</span><X className="h-3 w-3 shrink-0" />
                </button>
              )}
              {brand !== "all" && (
                <button type="button" onClick={() => setBrand("all")} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15">
                  <span className="truncate">Marca: {brand}</span><X className="h-3 w-3 shrink-0" />
                </button>
              )}
              {category !== "all" && (
                <button type="button" onClick={() => setCategory("all")} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15">
                  <span className="truncate">Categoría: {category}</span><X className="h-3 w-3 shrink-0" />
                </button>
              )}
              {inStockOnly && (
                <button type="button" onClick={() => setInStockOnly(false)} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15">
                  Solo con stock<X className="h-3 w-3 shrink-0" />
                </button>
              )}
              {withPriceOnly && (
                <button type="button" onClick={() => setWithPriceOnly(false)} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15">
                  Solo con precio<X className="h-3 w-3 shrink-0" />
                </button>
              )}
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setBrand("all");
                  setCategory("all");
                  setInStockOnly(false);
                  setWithPriceOnly(false);
                }}
              >
                <X className="h-3 w-3" />
                Limpiar
              </button>
            </div>
          )}
        </section>

        {productError && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{productError}</div>}

        {loadingProducts ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-lg bg-muted/80 dark:bg-muted/20" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/50 px-6 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/80">
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-foreground">No se encontraron productos</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Intenta ajustar tus filtros de búsqueda o cambiar de categoría.
            </p>
            {(search || brand !== "all" || category !== "all" || inStockOnly || withPriceOnly) && (
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setBrand("all");
                  setCategory("all");
                  setInStockOnly(false);
                  setWithPriceOnly(false);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.product_sku} product={product} onOpen={() => openProduct(product)} onAdd={() => addToCart(product)} />
              ))}
            </div>
            <div className="flex min-h-14 items-center justify-center">
              {loadingMoreProducts ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Cargando siguiente lote...
                </div>
              ) : totalProducts !== null && products.length >= totalProducts ? (
                <p className="text-sm text-muted-foreground">Ya viste todos los productos disponibles.</p>
              ) : (
                <Button variant="outline" className="bg-background" onClick={() => fetchProducts(products.length, true)}>
                  Cargar mas
                </Button>
              )}
            </div>
          </>
        )}
      </main>

      {showBackToTop && (
        <Button
          className="fixed bottom-6 right-5 z-40 h-12 w-12 rounded-full shadow-[0_18px_45px_-20px_hsl(var(--primary))] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
          size="icon"
          title="Volver arriba"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <span className="absolute inset-0 rounded-full bg-primary/25 motion-safe:animate-ping" />
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}

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

function AccessMetric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="group min-h-[6.25rem] overflow-hidden rounded-md border border-white/18 bg-white/12 p-4 shadow-sm backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/18">
      <div className="mb-3 flex h-10 w-10 items-center justify-center border border-white/16 rounded-md bg-white/16 text-emerald-100 shadow-sm transition group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[11px] font-medium text-white/68">{label}</p>
      <p className="mt-1 text-base font-bold text-white sm:text-lg">{value}</p>
    </div>
  );
}

function AccessSignal({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white/12 px-3 py-2 text-sm font-medium text-white">
      <Icon className="h-4 w-4 text-emerald-100" />
      <span>{label}</span>
    </div>
  );
}

function AccessNote({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="rounded-md border bg-background/75 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/10">
          <Icon className="h-4.5 w-4.5" />
        </span>
        {title}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function ProductCard({ product, onOpen, onAdd }: { product: EcommerceProduct; onOpen: () => void; onAdd: () => void }) {
  const hasPrice = product.price !== null && product.price !== undefined;
  const stock = Number(product.total_units_available || 0);
  const canAdd = Boolean(product.can_add_to_cart);
  return (
    <article className="group flex min-h-[22rem] flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-white/5">
      <button
        type="button"
        onClick={onOpen}
        className="relative m-3 mb-0 flex h-32 items-center justify-center overflow-hidden rounded-md bg-[linear-gradient(135deg,hsl(var(--muted))_0%,hsl(var(--primary)/0.08)_100%)] transition group-hover:bg-[linear-gradient(135deg,hsl(var(--primary)/0.12)_0%,hsl(var(--muted))_100%)]"
      >
        <div className="absolute right-3 top-3 rounded-full bg-background/85 px-2 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
          SKU
        </div>
        <Package className="h-11 w-11 text-primary transition duration-200 group-hover:scale-110" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="mb-3 flex min-h-6 flex-wrap gap-1.5">
          {product.product_category && <Badge variant="secondary" className="max-w-full truncate dark:bg-white/10 dark:text-white dark:hover:bg-white/20">{product.product_category}</Badge>}
          {!hasPrice && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">Sin precio</Badge>}
          {hasPrice && stock > 0 && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Disponible</Badge>}
        </div>

        <button type="button" onClick={onOpen} className="text-left">
          <h2 className="line-clamp-2 min-h-11 text-[0.98rem] font-bold leading-snug transition group-hover:text-primary">
            {text(product.product_commercial_name, "Producto sin nombre")}
          </h2>
        </button>
        <p className="mt-1 text-xs text-muted-foreground">SKU: {product.product_sku}</p>

        <div className="mt-4">
          <p className={cn("text-2xl font-black tracking-tight", !hasPrice && "text-foreground")}>
            {hasPrice ? money(product.price) : "Consultar precio"}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Inventario visible</p>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              stock > 0
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "bg-muted text-muted-foreground",
            )}>
              {stock.toLocaleString("es-CO")} und.
            </span>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <div className="grid grid-cols-[3rem_1fr] gap-2">
            <Button variant="outline" size="icon" className="h-11 rounded-md bg-background" onClick={onOpen} title="Ver detalle">
              <Search className="h-4 w-4" />
            </Button>
            <Button
              className="h-11 rounded-md font-bold shadow-sm transition-shadow hover:shadow-md"
              onClick={onAdd}
              disabled={!canAdd}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {canAdd ? "Añadir" : hasPrice ? "Sin stock" : "Añadir"}
            </Button>
          </div>
          {!canAdd && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground italic">
              {hasPrice ? "No disponible para pedido en este momento." : "Precio no asignado para este cliente."}
            </p>
          )}
        </div>
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
