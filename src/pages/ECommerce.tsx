import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  LocateFixed,
  LayoutGrid,
  List,
  LogOut,
  Loader2,
  LockKeyhole,
  Mail,
  MapPinned,
  MapPin,
  MessageSquareText,
  Moon,
  Minus,
  Package,
  PhoneCall,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
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
import logoFull from "@/assets/logo.png";
import logoIcon from "@/assets/logoico.png";
import bgImage from "@/assets/background.png";
import bgImage2 from "@/assets/background2.png";
import { ModuleErrorCard } from "@/components/common/ModuleErrorCard";
import { OtpBoxes } from "@/components/ui/otp-boxes";
import {
  checkoutEcommerce,
  createEcommerceSession,
  EcommerceCartItemInput,
  EcommerceCartQuote,
  EcommerceMyOrder,
  EcommerceProduct,
  EcommerceSession,
  getEcommerceFilterOptions,
  getEcommerceProductsPage,
  listMyEcommerceOrders,
  listTotal,
  quoteEcommerceCart,
  verifyEcommerceOtp,
} from "@/lib/api";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatApiErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import {
  filterEcommerceOrders,
  getEcommerceOrderStateLabel,
  getItemCountLabel,
  type OrderStateFilter,
} from "./ecommerceOrderUtils";

// Fix Leaflet default icon paths broken by Vite bundler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

const ivanagreenIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.75 14 22 14 22S28 23.75 28 14C28 6.27 21.73 0 14 0z" fill="#16a34a"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -36],
});

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function DeliveryMapPicker({
  lat,
  lng,
  onSelect,
}: {
  lat: number | null;
  lng: number | null;
  onSelect: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = lat != null && lng != null ? [lat, lng] : [4.5709, -74.2973];
  const markerPos: [number, number] | null = lat != null && lng != null ? [lat, lng] : null;
  return (
    <MapContainer
      key={`${lat}-${lng}`}
      center={center}
      zoom={lat != null ? 15 : 6}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapClickHandler onPick={onSelect} />
      {markerPos && <Marker position={markerPos} icon={ivanagreenIcon} />}
    </MapContainer>
  );
}

const PAGE_SIZE = 48;
const SESSION_KEY = "ivanagro_ecommerce_session";
const CART_KEY = "ivanagro_ecommerce_cart";

export type CheckoutFormState = {
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  delivery_address: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  payment_method: string;
  observations: string;
};

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

type CheckoutDialogProps = {
  open: boolean;
  form: CheckoutFormState;
  quote: EcommerceCartQuote | null;
  cartCount: number;
  checkoutLoading: boolean;
  checkoutError: string | null;
  onOpenChange: (open: boolean) => void;
  onChange: (field: keyof CheckoutFormState, value: string | number | null) => void;
  onSubmit: (event: React.FormEvent) => void;
};

const paymentOptions = [
  "PSE",
  "Transferencia bancaria",
  "Tarjeta de credito",
  "Tarjeta debito",
  "Nequi",
  "Daviplata",
  "Contra entrega",
  "Efectivo",
  "Credito autorizado",
  "Por definir",
];

export function CheckoutDialog({
  open,
  form,
  quote,
  cartCount,
  checkoutLoading,
  checkoutError,
  onOpenChange,
  onChange,
  onSubmit,
}: CheckoutDialogProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const total = quote?.total ?? 0;
  const productLabel = cartCount === 1 ? "1 producto listo para validar" : `${cartCount} productos listos para validar`;
  const hasQuoteErrors = Boolean(quote?.errors?.length);
  const isCheckoutReady = Boolean(
    form.contact_name.trim()
    && form.contact_phone.trim()
    && form.contact_email.trim()
    && form.delivery_address.trim()
    && form.payment_method.trim(),
  );
  const hasDeliveryCoordinates = form.delivery_latitude !== null && form.delivery_longitude !== null;
  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition((position) => {
      onChange("delivery_latitude", position.coords.latitude);
      onChange("delivery_longitude", position.coords.longitude);
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[92vh] max-h-[92vh] overflow-hidden rounded-lg border-white/40 p-0 shadow-[0_28px_90px_-38px_rgba(0,0,0,.85)] [&>button.absolute]:hidden sm:max-w-5xl">
        <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-lg bg-[#f8faf8] md:grid-cols-[1.12fr_0.88fr] md:grid-rows-none dark:bg-background">
          <aside
            className="relative min-h-[13rem] overflow-hidden border-b p-5 text-white md:order-2 md:min-h-0 md:rounded-r-lg md:border-b-0 md:border-l md:p-6"
            style={{
              backgroundImage: `linear-gradient(152deg, rgba(5, 46, 32, 0.9) 0%, rgba(10, 91, 55, 0.82) 52%, rgba(22, 101, 52, 0.62) 100%), url(${bgImage2 || bgImage})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,.14),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,.12))]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Checkout</p>
                <DialogTitle className="mt-2 text-2xl font-bold leading-tight text-white">Finalizar pedido</DialogTitle>
                <DialogDescription className="mt-2 max-w-sm text-sm leading-relaxed text-white/82">
                  Validaremos precio, inventario y condiciones comerciales antes de enviar la orden.
                </DialogDescription>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/12 backdrop-blur">
                <ClipboardCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="relative mt-5 rounded-md border border-white/20 bg-white/14 p-4 shadow-[0_22px_70px_-42px_rgba(0,0,0,.9)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-white/72">{productLabel}</p>
                  <p className="mt-1 text-[2rem] font-bold leading-none tracking-tight">{money(total)}</p>
                </div>
                <Badge className="border-white/20 bg-white/14 text-white hover:bg-white/14">Borrador</Badge>
              </div>
              <Separator className="my-3.5 bg-white/18" />
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Resumen del pedido</p>
                {quote?.items?.length ? (
                  <div className="space-y-2.5">
                    {quote.items.slice(0, 4).map((item) => (
                      <div key={`${item.sku}-${item.line_number}`} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                        <div>
                          <p className="line-clamp-2 font-medium text-white">{text(item.product_name, item.sku)}</p>
                          <p className="mt-0.5 text-xs text-white/58">SKU {item.sku} · Cant. {item.quantity}</p>
                        </div>
                        <p className="font-semibold">{money(item.line_total)}</p>
                      </div>
                    ))}
                    {quote.items.length > 4 && (
                      <p className="text-xs text-white/60">+ {quote.items.length - 4} productos adicionales</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-white/68">El total se recalculara con el inventario vigente.</p>
                )}
              </div>
            </div>

            <div className="relative mt-4 grid gap-2.5 text-sm font-medium text-white/82">
              <div className="flex items-center gap-2.5 rounded-md bg-black/10 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
                <ShieldCheck className="h-4 w-4 shrink-0 text-white" />
                Stock y precios confirmados
              </div>
              <div className="flex items-center gap-2.5 rounded-md bg-black/10 px-3 py-2 ring-1 ring-white/10 backdrop-blur">
                <Truck className="h-4 w-4 shrink-0 text-white" />
                Entrega segura y validada
              </div>
              <Button
                type="submit"
                form="checkout-order-form"
                className="mt-1 h-12 w-full gap-2 rounded-md bg-white font-bold text-emerald-950 shadow-[0_18px_40px_-28px_rgba(0,0,0,.95)] hover:bg-white/90"
                disabled={checkoutLoading || !isCheckoutReady}
              >
                {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Enviar orden
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-md border-white/55 bg-emerald-950/35 font-bold text-white shadow-[0_14px_32px_-28px_rgba(0,0,0,.95)] hover:bg-emerald-950/50 hover:text-white"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
            </div>
          </aside>

          <form id="checkout-order-form" className="flex min-h-0 flex-col bg-[#f8faf8] md:order-1 dark:bg-[#15161b]" onSubmit={onSubmit}>
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5 pr-5 md:p-4 md:pr-6">
              <CheckoutSection
                eyebrow="Paso 1"
                title="Datos de contacto"
                description="Usaremos estos datos para coordinar el envio de la orden."
                icon={<UserRound className="h-4 w-4" />}
              >
              <div className="grid gap-2.5 sm:grid-cols-2">
                  <CheckoutInput
                    id="checkout-contact-name"
                    label="Nombre contacto"
                    value={form.contact_name}
                    onChange={(value) => onChange("contact_name", value)}
                    icon={<UserRound className="h-4 w-4" />}
                    required
                  />
                  <CheckoutInput
                    id="checkout-contact-phone"
                    label="Celular"
                    value={form.contact_phone}
                    onChange={(value) => onChange("contact_phone", value)}
                    icon={<PhoneCall className="h-4 w-4" />}
                    required
                  />
                </div>
                <CheckoutInput
                  id="checkout-contact-email"
                  label="Email"
                  type="email"
                  value={form.contact_email}
                  onChange={(value) => onChange("contact_email", value)}
                  icon={<Mail className="h-4 w-4" />}
                />
              </CheckoutSection>

              <CheckoutSection
                eyebrow="Paso 2"
                title="Entrega"
                description="Incluye la direccion exacta para evitar reprocesos con logistica."
                icon={<MapPin className="h-4 w-4" />}
              >
                <CheckoutInput
                  id="checkout-delivery-address"
                  label="Direccion entrega"
                  value={form.delivery_address}
                  onChange={(value) => onChange("delivery_address", value)}
                  icon={<MapPin className="h-4 w-4" />}
                  required
                />
                <div className="rounded-md border border-dashed bg-muted/28 p-2.5 dark:border-white/12 dark:bg-black/16">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-start gap-2 rounded-md bg-background text-left font-semibold dark:bg-[#111217]"
                    onClick={() => setMapOpen((value) => !value)}
                  >
                    <MapPinned className="h-4 w-4 text-primary" />
                    {mapOpen ? "Cerrar mapa" : "Marcar direccion en el mapa"}
                  </Button>
                  {mapOpen && (
                    <div className="mt-2.5 overflow-hidden rounded-md border bg-background shadow-[0_14px_30px_-26px_rgba(15,23,42,.7)] dark:border-white/12 dark:bg-[#111217]">
                      <div className="h-56 w-full" style={{ cursor: "crosshair" }}>
                        <DeliveryMapPicker
                          lat={form.delivery_latitude}
                          lng={form.delivery_longitude}
                          onSelect={(lat, lng) => {
                            onChange("delivery_latitude", lat);
                            onChange("delivery_longitude", lng);
                          }}
                        />
                      </div>
                      <div className="flex flex-col gap-2 border-t p-2.5 text-xs text-muted-foreground dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          {hasDeliveryCoordinates
                            ? `Lat ${form.delivery_latitude?.toFixed(6)} | Long ${form.delivery_longitude?.toFixed(6)}`
                            : "Haz clic en el mapa para marcar el punto de entrega"}
                        </span>
                        <Button type="button" size="sm" className="h-8 gap-2 rounded-md" onClick={useCurrentLocation}>
                          <LocateFixed className="h-3.5 w-3.5" />
                          Usar mi ubicacion actual
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CheckoutSection>

              <CheckoutSection
                eyebrow="Paso 3"
                title="Pago y observaciones"
                description="Selecciona la condicion esperada y deja notas para el asesor."
                icon={<CreditCard className="h-4 w-4" />}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-payment-method">Metodo de pago</Label>
                  <Select value={form.payment_method} onValueChange={(value) => onChange("payment_method", value)}>
                    <SelectTrigger id="checkout-payment-method" aria-label="Metodo de pago" className="h-11">
                      <SelectValue placeholder="Seleccionar metodo" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-observations">Observaciones</Label>
                  <div className="relative">
                    <MessageSquareText className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="checkout-observations"
                      className="min-h-[72px] resize-none pl-9"
                      value={form.observations}
                      onChange={(event) => onChange("observations", event.target.value)}
                      placeholder="Notas adicionales"
                    />
                  </div>
                </div>
              </CheckoutSection>

              {(checkoutError || hasQuoteErrors) && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      {checkoutError && <p>{checkoutError}</p>}
                      {quote?.errors?.map((error) => <p key={`${error.sku}-${error.message}`}>{error.sku}: {error.message}</p>)}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckoutSection({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-card p-3 shadow-[0_10px_30px_-26px_rgba(15,23,42,.7)] dark:border-white/12 dark:bg-[#202126] dark:shadow-[0_18px_44px_-34px_rgba(0,0,0,.95)]">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/10">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">{title}</h3>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{description}</p>
      </div>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function CheckoutInput({
  id,
  label,
  value,
  onChange,
  icon,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
        <Input
          id={id}
          type={type}
          className="h-11 pl-9"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      </div>
    </div>
  );
}

const ECOMMERCE_THEME_KEY = "ecommerce-theme";

export default function ECommerce() {
  const { resolvedTheme, setTheme } = useTheme();
  const [session, setSession] = useState<EcommerceSession | null>(() => loadStoredSession());
  const [nit, setNit] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // OTP step
  const [otpStep, setOtpStep] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = "Ivanagro - E-Commerce";
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const [products, setProducts] = useState<EcommerceProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
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

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);

  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState<EcommerceMyOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderStateFilter, setOrderStateFilter] = useState<OrderStateFilter>("all");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormState>({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    delivery_address: "",
    delivery_latitude: null,
    delivery_longitude: null,
    payment_method: "",
    observations: "",
  });

  const token = session?.ecommerce_token ?? "";
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isDarkTheme = resolvedTheme === "dark";

  const hydrateCheckoutForm = useCallback((currentSession = session) => {
    if (!currentSession) return;
    setCheckoutForm((prev) => ({
      ...prev,
      contact_name: prev.contact_name || text(currentSession.customer.name, ""),
      contact_phone: prev.contact_phone || text(currentSession.customer.phone, ""),
      contact_email: prev.contact_email || text(currentSession.customer.email, ""),
      delivery_address: prev.delivery_address || text(currentSession.customer.address, ""),
    }));
  }, [session]);

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

  useEffect(() => {
    hydrateCheckoutForm();
  }, [hydrateCheckoutForm]);
  const brandOptions = useMemo(
    () => filters.brands.map((item) => String(item ?? "").trim()).filter(Boolean),
    [filters.brands],
  );
  const categoryOptions = useMemo(
    () => filters.categories.map((item) => String(item ?? "").trim()).filter(Boolean),
    [filters.categories],
  );
  const productsBySku = useMemo(
    () => new Map(products.map((product) => [product.product_sku, product])),
    [products],
  );

  const sortParams = useMemo(() => {
    if (sort === "price_asc") return { sort_by: "price", sort_dir: "asc" as const };
    if (sort === "price_desc") return { sort_by: "price", sort_dir: "desc" as const };
    if (sort === "available_desc") return { sort_by: "available", sort_dir: "desc" as const };
    if (sort === "name_desc") return { sort_by: "name", sort_dir: "desc" as const };
    return { sort_by: "name", sort_dir: "asc" as const };
  }, [sort]);

  const totalPages = useMemo(() =>
    totalProducts === null ? 1 : Math.max(1, Math.ceil(totalProducts / PAGE_SIZE)),
    [totalProducts]);

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (search) chips.push({ key: "search", label: `Búsqueda: ${search}`, clear: () => { setSearch(""); setSearchInput(""); } });
    if (brand !== "all") chips.push({ key: "brand", label: `Marca: ${brand}`, clear: () => setBrand("all") });
    if (category !== "all") chips.push({ key: "category", label: `Categoría: ${category}`, clear: () => setCategory("all") });
    if (inStockOnly) chips.push({ key: "stock", label: "Solo con stock", clear: () => setInStockOnly(false) });
    if (withPriceOnly) chips.push({ key: "price", label: "Solo con precio", clear: () => setWithPriceOnly(false) });
    return chips;
  }, [search, brand, category, inStockOnly, withPriceOnly]);

  const filteredOrders = useMemo(
    () => filterEcommerceOrders(orders, { state: orderStateFilter, dateFrom: orderDateFrom, dateTo: orderDateTo }),
    [orders, orderStateFilter, orderDateFrom, orderDateTo],
  );

  const fetchProducts = useCallback(async (page: number) => {
    if (!token) return;
    setLoadingProducts(true);
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
        offset: (page - 1) * PAGE_SIZE,
      });
      setProducts(response.data ?? []);
      setTotalProducts(listTotal(response));
    } catch (error) {
      setProductError(formatApiErrorMessage(error));
    } finally {
      setLoadingProducts(false);
    }
  }, [brand, category, inStockOnly, withPriceOnly, search, sortParams, token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => void fetchProducts(currentPage), 250);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, token, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, brand, category, inStockOnly, withPriceOnly, sort]);

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

  const clearAllFilters = () => {
    setSearchInput("");
    setSearch("");
    setBrand("all");
    setCategory("all");
    setInStockOnly(false);
    setWithPriceOnly(false);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleVerifyEcommerceOtp = async (codeOverride?: string) => {
    const code = codeOverride ?? otpCode;
    if (code.length !== 6) return;
    setOtpError(null);
    setOtpLoading(true);
    try {
      const sessionResult = await verifyEcommerceOtp({ otp_token: otpToken, code });
      setOtpStep(false);
      setOtpCode("");
      setSession(sessionResult);
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionResult));
      hydrateCheckoutForm(sessionResult);
      toast.success("Cliente validado correctamente", {
        description: `Bienvenido al e-commerce, ${text(sessionResult.customer.name, "cliente")}.`,
        duration: 3000,
      });
    } catch {
      const newAttempts = otpAttempts + 1;
      setOtpAttempts(newAttempts);
      if (newAttempts >= 3) {
        toast.error("Demasiados intentos fallidos", {
          description: "Por seguridad, debes ingresar tu NIT nuevamente.",
          duration: 4000,
        });
        setOtpStep(false);
        setOtpCode("");
        setOtpError(null);
        setOtpAttempts(0);
        setResendCooldown(0);
      } else {
        setOtpError("Código incorrecto. Intenta de nuevo.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendEcommerceOtp = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setOtpError(null);
    try {
      const next = await createEcommerceSession(nit.trim());
      if ("otp_required" in next && next.otp_required) {
        setOtpToken(next.otp_token);
        setOtpCode("");
        setResendCooldown(60);
        setPhoneHint(next.phone_hint ?? null);
        toast.success("Código reenviado", {
          description: "Se envió un nuevo código a tu teléfono.",
          duration: 3000,
        });
      }
    } catch {
      toast.error("No se pudo reenviar el código. Intenta de nuevo.");
    } finally {
      setResendLoading(false);
    }
  };

  const startSession = async (event: React.FormEvent) => {
    event.preventDefault();
    setSessionLoading(true);
    setSessionError(null);
    try {
      const next = await createEcommerceSession(nit.trim());
      if ("otp_required" in next && next.otp_required) {
        setOtpToken(next.otp_token);
        setOtpStep(true);
        setOtpAttempts(0);
        setResendCooldown(60);
        setPhoneHint(next.phone_hint ?? null);
        setSessionLoading(false);
        return;
      }
      const session = next as EcommerceSession;
      setSession(session);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      hydrateCheckoutForm(session);
      toast.success("Cliente validado correctamente", {
        description: `Bienvenido al e-commerce, ${text(session.customer.name, "cliente")}.`,
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

  const openOrders = async () => {
    setOrdersOpen(true);
    setOrdersLoading(true);
    try {
      const res = await listMyEcommerceOrders(token);
      const nextOrders = res.data ?? [];
      setOrders(nextOrders);
      setExpandedOrderId(nextOrders[0]?.id ?? null);
    } catch {
      setOrders([]);
      setExpandedOrderId(null);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      toast.error("Sesión expirada", {
        description: "Tu sesión ha expirado. Por favor ingresa nuevamente.",
        duration: 4000,
      });
      resetSession();
    };
    window.addEventListener("ivanagro:ecommerce_unauthorized", handleSessionExpired);
    return () => window.removeEventListener("ivanagro:ecommerce_unauthorized", handleSessionExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proactive session expiry timer — reacts to session changes
  useEffect(() => {
    if (!session?.expires_at) return;
    const msUntilExpiry = new Date(session.expires_at).getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      resetSession();
      return;
    }
    const timer = setTimeout(() => {
      toast.error("Sesión expirada", {
        description: "Tu sesión ha expirado. Por favor ingresa nuevamente.",
        duration: 4000,
      });
      resetSession();
    }, msUntilExpiry);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expires_at]);

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

  const openProduct = (product: EcommerceProduct) => {
    setSelectedProduct(product);
    setProductDetailOpen(true);
  };

  const openCheckout = () => {
    hydrateCheckoutForm();
    setCheckoutOpen(true);
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
        delivery_latitude: checkoutForm.delivery_latitude,
        delivery_longitude: checkoutForm.delivery_longitude,
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

                {!otpStep ? (
                  <>
                    <div className="mb-6 space-y-5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[linear-gradient(135deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.08))] text-primary shadow-[0_16px_36px_-24px_hsl(var(--primary))] ring-1 ring-primary/15">
                        <UserRound className="h-7 w-7" strokeWidth={2.2} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Acceso de cliente</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Valida tu cuenta comercial y entra al catálogo con precios personalizados.
                        </p>
                      </div>
                    </div>

                    <form className="space-y-4" onSubmit={startSession}>
                      {sessionError && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                          <span className="font-medium">{sessionError}</span>
                        </div>
                      )}
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
                      <button
                        type="submit"
                        disabled={sessionLoading || nit.trim().length < 3}
                        className="h-12 w-full rounded-xl text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
                        style={{ background: "linear-gradient(135deg, #0a963f 0%, #16a34a 100%)" }}
                      >
                        {sessionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Entrar al e-commerce
                      </button>
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
                  </>
                ) : (
                  <>
                    <div className="mb-6 text-center space-y-1.5">
                      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Verificación OTP</h2>
                      <p className="text-sm text-muted-foreground">
                        Ingresa el código de 6 dígitos enviado al número
                        {phoneHint && <span className="font-semibold text-foreground"> *****{phoneHint.slice(-4)}</span>}
                      </p>
                    </div>

                    {otpError && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                        <span className="font-medium">{otpError}</span>
                      </div>
                    )}

                    <div className="flex flex-col items-center gap-4 mb-6">
                      <OtpBoxes value={otpCode} onChange={setOtpCode} onComplete={(code) => handleVerifyEcommerceOtp(code)} />
                      <p className="text-xs text-muted-foreground">El código expira en unos minutos</p>
                    </div>

                    <button
                      onClick={() => handleVerifyEcommerceOtp()}
                      disabled={otpCode.length !== 6 || otpLoading}
                      className="h-12 w-full rounded-xl text-sm font-semibold text-white shadow-md disabled:opacity-60 flex items-center justify-center gap-2 mb-3"
                      style={{ background: "linear-gradient(135deg, #0a963f 0%, #16a34a 100%)" }}
                    >
                      {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Verificar código
                    </button>

                    <button
                      type="button"
                      onClick={handleResendEcommerceOtp}
                      disabled={resendCooldown > 0 || resendLoading}
                      className={`w-full text-center text-sm font-semibold rounded-xl py-2.5 mb-3 transition-colors border disabled:cursor-not-allowed ${
                        resendCooldown > 0 || resendLoading
                          ? "border-border text-muted-foreground opacity-50"
                          : "border-[#16a34a] text-[#16a34a] hover:bg-[#16a34a]/5"
                      }`}
                    >
                      {resendLoading
                        ? "Reenviando..."
                        : resendCooldown > 0
                          ? `Reenviar código (${resendCooldown}s)`
                          : "Reenviar código"}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setOtpStep(false); setOtpCode(""); setOtpError(null); setOtpAttempts(0); setResendCooldown(0); }}
                      className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground rounded-xl py-2.5 transition-colors"
                    >
                      Volver al inicio de sesión
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-[#FAFAFA] dark:bg-background lg:bg-background">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Logo solo visible en mobile — en desktop se mueve al sidebar */}
            <img src={logoFull} alt="Ivanagro" className="lg:hidden h-8 w-auto object-contain dark:brightness-0 dark:invert" />
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
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Abrir carrito"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground ring-1 ring-background">
                {cartCount > 99 ? "99+" : cartCount}
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
              <DropdownMenuItem className="gap-2 hover:bg-muted focus:bg-muted dark:hover:bg-white/10 dark:focus:bg-white/10 dark:hover:text-foreground dark:focus:text-foreground" onClick={openOrders}>
                <ShoppingBag className="h-4 w-4" />
                Mis pedidos
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive dark:hover:bg-red-500/15 dark:focus:bg-red-500/15" onClick={resetSession}>
                <LogOut className="h-4 w-4" />
                Cerrar sesion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex gap-6 items-start">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-[280px] shrink-0 sticky top-[4.5rem]">
            <div className="rounded-l-lg border bg-[#FAFAFA] dark:bg-card p-4 space-y-1 max-h-[calc(100vh-4.5rem)] overflow-y-auto">
              <div className="mb-4 flex justify-center">
                <img src={logoIcon} alt="Ivanagro" className="h-16 w-auto object-contain dark:brightness-0 dark:invert" />
              </div>
              <Separator style={{ marginTop: 0, marginBottom: "1rem" }} />
              <EcommerceSidebarFilters
                brandOptions={brandOptions}
                categoryOptions={categoryOptions}
                brand={brand}
                category={category}
                inStockOnly={inStockOnly}
                withPriceOnly={withPriceOnly}
                onBrandChange={setBrand}
                onCategoryChange={setCategory}
                onInStockChange={setInStockOnly}
                onWithPriceChange={setWithPriceOnly}
                onClear={clearAllFilters}
                hasActiveFilters={activeFilters.length > 0}
                disabled={loadingProducts || !!productError}
              />
            </div>
          </aside>
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-4">
            <EcommerceResultsHeader
              search={search}
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              onSearchCommit={() => setSearch(searchInput.trim())}
              onSearchClear={() => { setSearchInput(""); setSearch(""); }}
              sort={sort}
              onSortChange={setSort}
              inStockOnly={inStockOnly}
              withPriceOnly={withPriceOnly}
              onInStockToggle={() => setInStockOnly((v) => !v)}
              onWithPriceToggle={() => setWithPriceOnly((v) => !v)}
              totalProducts={totalProducts}
              currentPage={currentPage}
              activeFilters={activeFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onOpenMobileFilters={() => setMobileFiltersOpen(true)}
              onClear={clearAllFilters}
              disabled={loadingProducts || !!productError}
              hasError={!!productError}
            />
            {productError && (
              <ModuleErrorCard
                message={productError}
                onRetry={() => void fetchProducts(currentPage)}
                loading={loadingProducts}
              />
            )}
            {loadingProducts ? (
              <EcommerceSkeletonGrid viewMode={viewMode} />
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-20 text-center">
                <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="mt-1 max-w-sm text-md text-muted-foreground">
                  {activeFilters.length > 0 ? "No encontramos productos con los filtros aplicados." : "No hay productos disponibles en este momento."}
                </p>
                {activeFilters.length > 0 && (
                  <Button variant="outline" className="mt-6" onClick={clearAllFilters}>
                    <X className="mr-2 h-4 w-4" />Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                {viewMode === "grid" ? (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {products.map((product) => (
                      <EcommerceProductCard key={product.product_sku} product={product} onOpen={() => openProduct(product)} onAdd={() => addToCart(product)} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {products.map((product) => (
                      <EcommerceProductListRow key={product.product_sku} product={product} onOpen={() => openProduct(product)} onAdd={() => addToCart(product)} />
                    ))}
                  </div>
                )}
                <EcommercePagination currentPage={currentPage} totalPages={totalPages} totalProducts={totalProducts} onPageChange={handlePageChange} />
              </>
            )}
          </div>
        </div>
      </main>

      <MobileFiltersDrawer
        open={mobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        brandOptions={brandOptions}
        categoryOptions={categoryOptions}
        brand={brand}
        category={category}
        inStockOnly={inStockOnly}
        withPriceOnly={withPriceOnly}
        onBrandChange={setBrand}
        onCategoryChange={setCategory}
        onInStockChange={setInStockOnly}
        onWithPriceChange={setWithPriceOnly}
        onClear={clearAllFilters}
        hasActiveFilters={activeFilters.length > 0}
      />
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
                    const productImageUrl = productsBySku.get(item.sku)?.product_image_url;
                    return (
                      <div key={item.sku} className="rounded-md border bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
                              {productImageUrl ? (
                                <img
                                  src={productImageUrl}
                                  alt={quoted?.product_name ?? item.sku}
                                  className="h-full w-full object-contain p-1"
                                  onError={(event) => { event.currentTarget.src = "/placeholder.svg"; }}
                                />
                              ) : (
                                <img src="/placeholder.svg" alt="" className="h-8 w-8 opacity-55 dark:invert" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{quoted?.product_name ?? item.sku}</p>
                              <p className="mt-1 text-xs text-muted-foreground">SKU: {item.sku}</p>
                              <p className="mt-2 font-bold">{quoted ? money(quoted.line_total) : "Pendiente"}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" disabled={quoteLoading} onClick={() => setQuantity(item.sku, 0)}>
                            {quoteLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={quoteLoading} onClick={() => setQuantity(item.sku, item.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                          <span className="w-10 text-center font-semibold">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={quoteLoading} onClick={() => setQuantity(item.sku, item.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-md border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="text-2xl font-bold">{money(quote?.total ?? 0)}</span>
                  </div>
                  <Button className="mt-4 h-11 w-full gap-2" disabled={quoteLoading || !quote || quote.errors.length > 0 || cart.length === 0} onClick={openCheckout}>
                    {quoteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {quoteLoading ? "Actualizando pedido" : "Finalizar pedido"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={productDetailOpen} onOpenChange={setProductDetailOpen}>
        <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
          {selectedProduct && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="px-4 pb-2 pt-4">
                <DialogHeader>
                  <DialogTitle className="text-[17px] font-semibold leading-snug">
                    {text(selectedProduct.product_commercial_name, "Producto sin nombre")}
                  </DialogTitle>
                  <DialogDescription asChild>
                    <span className="mt-1 inline-flex">
                      <span className="font-mono text-[11px] bg-background/90 border rounded-md px-1.5 py-0.5 text-muted-foreground">
                        SKU: {selectedProduct.product_sku}
                      </span>
                    </span>
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Body: image left + info right */}
              <div className="flex gap-0 border-t border-border/40">
                {/* Image — fixed width, zoom on hover */}
                <div className="relative flex w-36 shrink-0 items-center justify-center overflow-hidden bg-white p-2">
                  {selectedProduct.product_image_url ? (
                    <img
                      src={selectedProduct.product_image_url}
                      alt={selectedProduct.product_commercial_name ?? ""}
                      className="h-32 w-32 cursor-default object-contain transition-transform duration-300 ease-out hover:scale-125"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="flex h-32 w-32 flex-col items-center justify-center gap-2 text-muted-foreground/50">
                      <Package className="h-8 w-8" />
                      <span className="text-[11px]">Sin imagen</span>
                    </div>
                  )}
                </div>

                {/* Vertical divider */}
                <div className="w-px self-stretch bg-border/40" />

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between gap-2 px-3 py-3">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Fact label="Marca" value={selectedProduct.product_brand_name} />
                    <Fact label="Categoría" value={selectedProduct.product_category} />
                    <Fact label="Inventario" value={Number(selectedProduct.total_units_available || 0) > 0 ? "Disponible" : "No disponible"} />
                    <Fact label="Precio" value={selectedProduct.price == null ? "Sin precio" : money(selectedProduct.price)} />
                  </div>
                  {selectedProduct.product_technical_description && (
                    <div className="rounded-md border border-border/40 bg-muted/30 px-2.5 py-2">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Descripción</p>
                      <p className="line-clamp-3 text-[12px] leading-relaxed text-foreground/80">{selectedProduct.product_technical_description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer CTA */}
              <div className="border-t border-border/40 px-4 py-4">
                <Button
                  className="w-full gap-2 font-semibold"
                  disabled={!selectedProduct.can_add_to_cart}
                  onClick={() => addToCart(selectedProduct)}
                >
                  <ShoppingCart className="h-4 w-4" />Añadir al carrito
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CheckoutDialog
        open={checkoutOpen}
        form={checkoutForm}
        quote={quote}
        cartCount={cartCount}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
        onOpenChange={setCheckoutOpen}
        onChange={(field, value) => setCheckoutForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={submitCheckout}
      />

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

      {/* Mis pedidos drawer */}
      <Sheet open={ordersOpen} onOpenChange={setOrdersOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
          <div className="border-b px-4 pb-4 pt-5 sm:px-6">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Mis pedidos
              </SheetTitle>
              <SheetDescription>Historial de órdenes realizadas</SheetDescription>
            </SheetHeader>
          </div>
          <div className="px-4 py-4 sm:px-6 space-y-3">
            {ordersLoading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!ordersLoading && orders.length > 0 && (
              <div className="grid gap-2 rounded-md border bg-card p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="order-state-filter">Estado</Label>
                  <Select value={orderStateFilter} onValueChange={(value) => setOrderStateFilter(value as OrderStateFilter)}>
                    <SelectTrigger id="order-state-filter" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="open">Abierto</SelectItem>
                      <SelectItem value="closed">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="order-date-from">De</Label>
                    <Input
                      id="order-date-from"
                      type="date"
                      className="h-10"
                      value={orderDateFrom}
                      onChange={(event) => setOrderDateFrom(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="order-date-to">Hasta</Label>
                    <Input
                      id="order-date-to"
                      type="date"
                      className="h-10"
                      value={orderDateTo}
                      onChange={(event) => setOrderDateTo(event.target.value)}
                    />
                  </div>
                </div>
                {(orderStateFilter !== "all" || orderDateFrom || orderDateTo) && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 justify-start px-2 text-xs text-muted-foreground"
                    onClick={() => {
                      setOrderStateFilter("all");
                      setOrderDateFrom("");
                      setOrderDateTo("");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            )}
            {!ordersLoading && orders.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <ShoppingBag className="h-12 w-12 opacity-25" />
                <div>
                  <p className="text-sm font-medium">Sin pedidos todavía</p>
                  <p className="mt-1 text-xs">Tus órdenes aparecerán aquí una vez las realices.</p>
                </div>
              </div>
            )}
            {!ordersLoading && orders.length > 0 && filteredOrders.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No hay pedidos con esos filtros.
              </div>
            )}
            {!ordersLoading && filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const stateLabel = getEcommerceOrderStateLabel(order.status);
              return (
                <div key={order.id} className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  >
                    <div className="flex-1 text-left space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{order.reference}</span>
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          stateLabel === "Cerrado"
                            ? "border-border bg-muted/60 text-muted-foreground"
                            : "border-primary/25 bg-primary/10 text-primary dark:border-emerald-400/25 dark:bg-emerald-400/12 dark:text-emerald-200",
                        )}>
                          {stateLabel}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{new Date(order.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        <span>{getItemCountLabel(order.items_count)}</span>
                        <span className="font-medium text-foreground">{money(order.total)}</span>
                      </div>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-90")} />
                  </button>
                  {isExpanded && (
                    <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
                      {order.items.map((item) => (
                        <div key={item.line_number} className="flex justify-between items-start gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.product_name ?? item.product_sku}</p>
                            <p className="text-xs text-muted-foreground">SKU: {item.product_sku} · Cant: {item.quantity} · {money(item.unit_price)} c/u</p>
                          </div>
                          <span className="font-semibold shrink-0">{money(item.line_total)}</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total</span>
                        <span>{money(order.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
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


// ── Sidebar Filters ──────────────────────────────────────────────────────────

interface SidebarFiltersProps {
  brandOptions: string[];
  categoryOptions: string[];
  brand: string;
  category: string;
  inStockOnly: boolean;
  withPriceOnly: boolean;
  onBrandChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onInStockChange: (v: boolean) => void;
  onWithPriceChange: (v: boolean) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  disabled?: boolean;
}

function EcommerceSidebarFilters({ brandOptions, categoryOptions, brand, category, inStockOnly, withPriceOnly, onBrandChange, onCategoryChange, onInStockChange, onWithPriceChange, onClear, hasActiveFilters, disabled }: SidebarFiltersProps) {
  const [brandSearch, setBrandSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  const filteredBrands = brandSearch.trim()
    ? brandOptions.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()))
    : brandOptions;

  const filteredCategories = categorySearch.trim()
    ? categoryOptions.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()))
    : categoryOptions;

  return (
    <div className={cn("space-y-3", disabled && "pointer-events-none opacity-50")}>
      {/* Marcas */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group flex w-full items-center justify-between py-1.5 text-sm font-semibold hover:text-primary">
          <span className="flex items-center gap-2"><Tags className="h-3.5 w-3.5 text-muted-foreground" />Marcas</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="relative mb-1.5 mt-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Buscar marca..."
              className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-6 text-sm placeholder:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {brandSearch && (
              <button
                onClick={() => setBrandSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <RadioGroup value={brand} onValueChange={onBrandChange} className="pt-0.5 space-y-0.5">
            {!brandSearch.trim() && (
              <div className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="brand-all" className="shrink-0" />
                <Label htmlFor="brand-all" className="cursor-pointer truncate text-sm font-normal">Todas las marcas</Label>
              </div>
            )}
            <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
              {filteredBrands.map((b) => (
                <div key={b} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value={b} id={`brand-${b}`} className="shrink-0" />
                  <Label htmlFor={`brand-${b}`} className="cursor-pointer truncate text-sm font-normal">{b}</Label>
                </div>
              ))}
              {filteredBrands.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Sin resultados</p>}
            </div>
          </RadioGroup>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Categorías */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group flex w-full items-center justify-between py-1.5 text-sm font-semibold hover:text-primary">
          <span className="flex items-center gap-2"><Store className="h-3.5 w-3.5 text-muted-foreground" />Categorías</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="relative mb-1.5 mt-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Buscar categoría..."
              className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-6 text-sm placeholder:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {categorySearch && (
              <button
                onClick={() => setCategorySearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <RadioGroup value={category} onValueChange={onCategoryChange} className="pt-0.5 space-y-0.5">
            {!categorySearch.trim() && (
              <div className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="cat-all" className="shrink-0" />
                <Label htmlFor="cat-all" className="cursor-pointer truncate text-sm font-normal">Todas las categorías</Label>
              </div>
            )}
            <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
              {filteredCategories.map((c) => (
                <div key={c} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value={c} id={`cat-${c}`} className="shrink-0" />
                  <Label htmlFor={`cat-${c}`} className="cursor-pointer truncate text-sm font-normal">{c}</Label>
                </div>
              ))}
              {filteredCategories.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Sin resultados</p>}
            </div>
          </RadioGroup>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Disponibilidad */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group flex w-full items-center justify-between py-1.5 text-sm font-semibold hover:text-primary">
          <span className="flex items-center gap-2"><Package className="h-3.5 w-3.5 text-muted-foreground" />Disponibilidad</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex items-center gap-2 pt-2 px-1 cursor-pointer" onClick={() => onInStockChange(!inStockOnly)}>
            <Checkbox id="in-stock" checked={inStockOnly} onCheckedChange={(v) => onInStockChange(Boolean(v))} />
            <Label htmlFor="in-stock" className="cursor-pointer text-sm font-normal">Con stock disponible</Label>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Precio */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group flex w-full items-center justify-between py-1.5 text-sm font-semibold hover:text-primary">
          <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-muted-foreground" />Precio</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex items-center gap-2 pt-2 px-1 cursor-pointer" onClick={() => onWithPriceChange(!withPriceOnly)}>
            <Checkbox id="with-price" checked={withPriceOnly} onCheckedChange={(v) => onWithPriceChange(Boolean(v))} />
            <Label htmlFor="with-price" className="cursor-pointer text-sm font-normal">Con precio asignado</Label>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground hover:text-foreground" onClick={onClear}>
          <X className="h-3.5 w-3.5" />Limpiar filtros
        </Button>
      )}
    </div>
  );
}

// ── Results Header ────────────────────────────────────────────────────────────

interface ResultsHeaderProps {
  search: string;
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  onSearchCommit: () => void;
  onSearchClear: () => void;
  sort: string;
  onSortChange: (v: string) => void;
  inStockOnly: boolean;
  withPriceOnly: boolean;
  onInStockToggle: () => void;
  onWithPriceToggle: () => void;
  totalProducts: number | null;
  currentPage: number;
  activeFilters: Array<{ key: string; label: string; clear: () => void }>;
  viewMode: "grid" | "list";
  onViewModeChange: (v: "grid" | "list") => void;
  onOpenMobileFilters: () => void;
  onClear: () => void;
  disabled?: boolean;
  hasError?: boolean;
}

function EcommerceResultsHeader({ search, searchInput, onSearchInputChange, onSearchCommit, onSearchClear, sort, onSortChange, inStockOnly, withPriceOnly, onInStockToggle, onWithPriceToggle, totalProducts, currentPage, activeFilters, viewMode, onViewModeChange, onOpenMobileFilters, onClear, disabled, hasError }: ResultsHeaderProps) {
  const from = ((currentPage - 1) * PAGE_SIZE + 1).toLocaleString("es-CO");
  const to = totalProducts !== null
    ? Math.min(currentPage * PAGE_SIZE, totalProducts).toLocaleString("es-CO")
    : (currentPage * PAGE_SIZE).toLocaleString("es-CO");

  return (
    <div className="space-y-3">
      {/* Row 1: count + sort + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {hasError
            ? <>Mostrando <span className="text-foreground">0</span> de <span className="text-foreground">0</span> productos</>
            : totalProducts === null
              ? <Skeleton className="inline-block h-4 w-40 align-middle" />
              : <>Mostrando <span className="text-foreground">{from}–{to}</span> de <span className="text-foreground">{totalProducts.toLocaleString("es-CO")}</span> productos</>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={onSortChange} disabled={disabled}>
            <SelectTrigger className="h-9 w-44 bg-background text-sm">
              <div className="flex items-center gap-2">
                <ArrowDownAZ className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Nombre A-Z</SelectItem>
              <SelectItem value="name_desc">Nombre Z-A</SelectItem>
              <SelectItem value="price_asc">Menor precio</SelectItem>
              <SelectItem value="price_desc">Mayor precio</SelectItem>
              <SelectItem value="available_desc">Mayor stock</SelectItem>
            </SelectContent>
          </Select>
          <div className={cn("hidden sm:flex rounded-md border bg-background overflow-hidden", disabled && "pointer-events-none opacity-50")}>
            <button onClick={() => onViewModeChange("grid")} className={cn("flex h-9 w-9 items-center justify-center transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title="Vista cuadrícula" disabled={disabled}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => onViewModeChange("list")} className={cn("flex h-9 w-9 items-center justify-center transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} title="Vista lista" disabled={disabled}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: search */}
      <div className="relative">
        <button onClick={onSearchCommit} disabled={disabled} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed">
          <Search className="h-4 w-4" />
        </button>
        <input
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchCommit()}
          placeholder="Buscar por SKU, nombre, marca o categoría..."
          disabled={disabled}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pl-9 pr-9 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {search && (
          <button onClick={onSearchClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Row 3: quick toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="lg:hidden gap-2 h-8 bg-background" onClick={onOpenMobileFilters} disabled={disabled}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeFilters.length > 0 && <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{activeFilters.length}</span>}
        </Button>
        <Button variant={inStockOnly ? "default" : "outline"} size="sm" className={cn("h-8 gap-1.5", !inStockOnly && "bg-background")} onClick={onInStockToggle}>Con stock</Button>
        <Button variant={withPriceOnly ? "default" : "outline"} size="sm" className={cn("h-8 gap-1.5", !withPriceOnly && "bg-background")} onClick={onWithPriceToggle}>Con precio</Button>
        {activeFilters.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={onClear} disabled={disabled}>
            <X className="h-3.5 w-3.5" />Limpiar filtros
          </Button>
        )}
      </div>

      {/* Row 4: active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map((chip) => (
            <button key={chip.key} onClick={chip.clear} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/15">
              <span className="truncate max-w-[12rem]">{chip.label}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function EcommerceProductCard({ product, onOpen, onAdd }: { product: EcommerceProduct; onOpen: () => void; onAdd: () => void }) {
  const hasPrice = product.price !== null && product.price !== undefined;
  const stock = Number(product.total_units_available || 0);
  const canAdd = Boolean(product.can_add_to_cart);
  const isDiscontinued = Boolean(product.product_is_discontinued);

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md sm:flex-col">
      {/* imagen: fila en mobile, columna en sm+ */}
      <button
        type="button"
        onClick={onOpen}
        className="relative flex shrink-0 items-center justify-center bg-muted/40 dark:bg-muted transition group-hover:bg-muted/60 dark:group-hover:bg-muted
                   h-28 w-full sm:h-40 sm:w-full overflow-hidden"
      >
        {product.product_image_url ? (
          <img
            src={product.product_image_url}
            alt={product.product_commercial_name ?? ""}
            className="h-full w-full object-contain p-2"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <Package className="h-10 w-10 text-muted-foreground/50 transition group-hover:text-muted-foreground sm:h-12 sm:w-12" />
        )}
        <span className="absolute right-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground shadow-sm">
          {product.product_sku}
        </span>
      </button>

      <div className="flex flex-1 flex-col p-3 gap-1.5 sm:p-4">
        <button type="button" onClick={onOpen} className="text-left">
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
            {text(product.product_commercial_name, "Producto sin nombre")}
          </h2>
        </button>

        {product.product_brand_name && (
          <div className="flex items-center gap-1">
            <p className="truncate text-xs text-muted-foreground">{product.product_brand_name}</p>
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
          </div>
        )}

        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
          ))}
        </div>

        <TooltipProvider delayDuration={300}>
          <div className="flex gap-1 min-w-0 overflow-hidden">
            {product.product_category && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="min-w-0 max-w-[50%] overflow-hidden text-[11px] font-normal bg-primary/10 text-primary border-transparent dark:bg-primary/20 dark:text-primary"><span className="truncate">{product.product_category}</span></Badge>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{product.product_category}</p></TooltipContent>
              </Tooltip>
            )}
            {product.product_line_name && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="min-w-0 max-w-[50%] overflow-hidden text-[11px] font-normal bg-primary/90 text-primary-foreground border-transparent"><span className="truncate">{product.product_line_name}</span></Badge>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{product.product_line_name}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>

        {isDiscontinued && (
          <Badge variant="outline" className="w-fit border-amber-300 bg-amber-50 text-amber-700 text-[11px] dark:bg-amber-500/10 dark:text-amber-200">Descontinuado</Badge>
        )}

        <div className="mt-auto">
          {hasPrice ? (
            <>
              <p className="text-lg font-black tracking-tight sm:text-xl">{money(product.price)}</p>
              <p className="text-[11px] text-muted-foreground">Precio asignado</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">Sin precio</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Inventario</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", stock > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            {stock > 0 ? "Disponible" : "No disponible"}
          </span>
        </div>

        <div className="grid grid-cols-[2.25rem_1fr] gap-1.5 pt-1">
          <Button variant="outline" size="icon" className="h-9 w-9 bg-background" onClick={onOpen} title="Ver detalle">
            <Search className="h-4 w-4" />
          </Button>
          <Button className="h-9 font-semibold text-xs sm:text-sm" onClick={onAdd} disabled={!canAdd}>
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
            {canAdd ? "Añadir" : hasPrice ? "Sin stock" : "Añadir"}
          </Button>
        </div>
      </div>
    </article>
  );
}

// ── Product List Row ──────────────────────────────────────────────────────────

function EcommerceProductListRow({ product, onOpen, onAdd }: { product: EcommerceProduct; onOpen: () => void; onAdd: () => void }) {
  const hasPrice = product.price !== null && product.price !== undefined;
  const stock = Number(product.total_units_available || 0);
  const canAdd = Boolean(product.can_add_to_cart);

  return (
    <article className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-muted/40 transition-opacity hover:opacity-75 dark:bg-muted"
        title="Ver detalle"
      >
        {product.product_image_url ? (
          <img
            src={product.product_image_url}
            alt={product.product_commercial_name ?? ""}
            className="h-full w-full object-contain p-1"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <Package className="h-6 w-6 text-muted-foreground/60" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onOpen} className="truncate text-sm font-semibold hover:text-primary transition-colors text-left">
            {text(product.product_commercial_name, "Producto sin nombre")}
          </button>
          <span className="shrink-0 font-mono text-[11px] bg-background/90 border rounded-md px-1.5 py-0.5 text-muted-foreground">{product.product_sku}</span>
        </div>
        <TooltipProvider delayDuration={300}>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {product.product_brand_name && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                {product.product_brand_name}
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              </span>
            )}
            {product.product_category && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="min-w-0 max-w-[140px] overflow-hidden text-[11px] font-normal bg-primary/10 text-primary border-transparent dark:bg-primary/20 dark:text-primary">
                    <span className="truncate">{product.product_category}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{product.product_category}</p></TooltipContent>
              </Tooltip>
            )}
            {product.product_line_name && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="min-w-0 max-w-[140px] overflow-hidden text-[11px] font-normal bg-primary/90 text-primary-foreground border-transparent">
                    <span className="truncate">{product.product_line_name}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top"><p>{product.product_line_name}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
        <div className="flex items-center gap-0.5 mt-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
          ))}
        </div>
      </div>
      <div className="hidden sm:block shrink-0 w-28 text-right">
        {hasPrice ? <p className="text-sm font-bold">{money(product.price)}</p> : <p className="text-sm text-muted-foreground">Sin precio</p>}
      </div>
      <div className="hidden md:block shrink-0">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", stock > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          {stock > 0 ? "Disponible" : "No disponible"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpen}>
          <Search className="h-4 w-4" />
        </Button>
        <Button size="sm" className="shrink-0 h-9" onClick={onAdd} disabled={!canAdd}>
          <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Añadir
        </Button>
      </div>
    </article>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function EcommercePagination({ currentPage, totalPages, totalProducts, onPageChange }: { currentPage: number; totalPages: number; totalProducts: number | null; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center pt-4">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={(e) => { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); }} className={cn(currentPage === 1 && "pointer-events-none opacity-50")} href="#" aria-label="Ir a página anterior">
              Anterior
            </PaginationPrevious>
          </PaginationItem>
          {pages.map((page, idx) =>
            page === "ellipsis" ? (
              <PaginationItem key={`el-${idx}`}><PaginationEllipsis /></PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink href="#" onClick={(e) => { e.preventDefault(); onPageChange(page); }} isActive={page === currentPage}>{page}</PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); }} className={cn(currentPage === totalPages && "pointer-events-none opacity-50")} href="#">
              Siguiente
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

// ── Skeleton Grid ─────────────────────────────────────────────────────────────

function EcommerceSkeletonGrid({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
            <Skeleton className="hidden sm:block h-4 w-24" />
            <Skeleton className="hidden md:block h-6 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-lg border bg-card dark:bg-muted/20">
          <Skeleton className="h-40 w-full rounded-none dark:bg-muted/60" />
          <div className="flex flex-col gap-3 p-4">
            <div className="flex gap-1"><Skeleton className="h-5 w-20 rounded-full dark:bg-muted/60" /><Skeleton className="h-5 w-16 rounded-full dark:bg-muted/60" /></div>
            <Skeleton className="h-4 w-full dark:bg-muted/60" /><Skeleton className="h-4 w-3/4 dark:bg-muted/60" />
            <Skeleton className="h-6 w-28 mt-1 dark:bg-muted/60" />
            <div className="flex items-center justify-between mt-1"><Skeleton className="h-3 w-10 dark:bg-muted/60" /><Skeleton className="h-5 w-20 rounded-full dark:bg-muted/60" /></div>
            <div className="grid grid-cols-[2.5rem_1fr] gap-2 pt-1"><Skeleton className="h-10 w-10 rounded-md dark:bg-muted/60" /><Skeleton className="h-10 rounded-md dark:bg-muted/60" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mobile Filters Drawer ─────────────────────────────────────────────────────

function MobileFiltersDrawer({ open, onOpenChange, ...filterProps }: { open: boolean; onOpenChange: (v: boolean) => void } & SidebarFiltersProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col p-0 w-80">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Filtros
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-0 mt-0 pb-3">
          <EcommerceSidebarFilters {...filterProps} />
        </div>
        <SheetFooter className="border-t p-4">
          <Button className="w-full" onClick={() => onOpenChange(false)}>Ver resultados</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/30 px-2.5 py-2">
      <p className="text-[11px] font-medium capitalize text-muted-foreground">{label}</p>
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
