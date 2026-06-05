import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';

const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });
import {
  createPromotion,
  getAllCustomers,
  getAllProducts,
  getAllRepresentatives,
  getCustomerFilterOptions,
  getProductFilterOptions,
  getPromotion,
  getPromotionBudget,
  getCustomersPage,
  listProducts,
  RequiredPromotionProduct,
  updatePromotion,
  updatePromotionStatus,
  CustomerRecord,
  FilterOptionItem,
  ProductCatalogItem,
  Representative,
  listTotal,
} from '@/lib/api';
import { usePromoter } from '@/contexts/PromoterContext';
import { Laboratory, Promotion } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  FileText,
  Package,
  Users,
  Zap,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
  DollarSign,
  AlertTriangle,
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BONUS_PRODUCT_TYPE_OPTIONS,
  BUNDLE_RULE_OPTIONS,
  COMBO_BENEFIT_OPTIONS,
  createRequiredProduct,
  DISCOUNT_TYPE_OPTIONS,
  EMPTY_MECHANIC,
  inferMechanicStateFromPromotion,
  MINIMUM_TYPE_OPTIONS,
  PROMOTION_TYPE_OPTIONS,
  resetMechanicForPromotionType,
  summarizePromotionMechanic,
  validatePromotionMechanic,
  buildPromotionMechanicPayload,
  PromotionMechanicFormState,
} from '@/lib/promotionMechanics';

interface PromotionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratories: Laboratory[];
  onSuccess: () => void;
  editingPromo?: { id: string } | null;
}

const SEGMENT_OPTIONS = [
  { value: 'custom', label: 'Segmentacion manual' },
  { value: 'with_purchases', label: 'Clientes con compras' },
  { value: 'without_purchases', label: 'Clientes sin compras' },
  { value: 'with_representative', label: 'Con representante' },
  { value: 'without_representative', label: 'Sin representante' },
  { value: 'active_recent', label: 'Activos 1 a 45 dias' },
  { value: 'at_risk', label: 'En riesgo 46 a 90 dias' },
  { value: 'inactive', label: 'Inactivos 91+ dias' },
];

const SCOPE_OPTIONS = [
  { value: 'customers', label: 'Clientes especificos' },
  { value: 'customer_segment', label: 'Segmento de clientes' },
  { value: 'all', label: 'Toda mi base' },
];
const PRODUCT_APPLICATION_OPTIONS = [
  { value: 'specific', label: 'Productos especificos' },
  { value: 'filters', label: 'Marca / Sector / Categoria / Especie' },
];

const ACCOUNTING_TREATMENTS = [
  { value: 'descuento_pie', label: 'Descuento Pie de Factura' },
  { value: 'bonificacion_precio_cero', label: 'Bonificacion a Precio Cero' },
  { value: 'precio_especial', label: 'Precio Especial' },
];
const WITHOUT_REPRESENTATIVE_OPTION = 'without_rep';

const formFocusClasses = [
  '[&_input:focus-visible]:!border-primary/60',
  '[&_input:focus-visible]:!ring-1',
  '[&_input:focus-visible]:!ring-primary/20',
  '[&_input:focus-visible]:!ring-offset-0',
  '[&_textarea:focus-visible]:!border-primary/60',
  '[&_textarea:focus-visible]:!ring-1',
  '[&_textarea:focus-visible]:!ring-primary/20',
  '[&_textarea:focus-visible]:!ring-offset-0',
  '[&_[role=combobox]:focus]:!border-primary/60',
  '[&_[role=combobox]:focus]:!ring-1',
  '[&_[role=combobox]:focus]:!ring-primary/20',
  '[&_[role=combobox]:focus]:!ring-offset-0',
].join(' ');

const requiredProductKeys = new WeakMap<RequiredPromotionProduct, string>();
let requiredProductKeyCounter = 0;

function requiredProductKey(item: RequiredPromotionProduct) {
  const existing = requiredProductKeys.get(item);
  if (existing) return existing;
  requiredProductKeyCounter += 1;
  const key = `required-product-${requiredProductKeyCounter}`;
  requiredProductKeys.set(item, key);
  return key;
}

function buildSegmentPresetConfig(segment: string): Record<string, unknown> {
  switch (segment) {
    case 'with_purchases':
      return { min_purchases: 1 };
    case 'without_purchases':
      return { max_purchases: 0 };
    case 'with_representative':
      return { has_sales_representative: true };
    case 'without_representative':
      return { has_sales_representative: false };
    case 'active_recent':
      return { min_purchases: 1, min_days_since_last_purchase: 1, max_days_since_last_purchase: 45 };
    case 'at_risk':
      return { min_purchases: 1, min_days_since_last_purchase: 46, max_days_since_last_purchase: 90 };
    case 'inactive':
      return { min_purchases: 1, min_days_since_last_purchase: 91 };
    default:
      return {};
  }
}

function representativeOption(representative: Representative): [string, string] | null {
  const id = String(representative.sales_representative_id ?? representative.id ?? '');
  const name = String(representative.sales_rep_full_name ?? '');
  return id && name ? [id, name] : null;
}

const STEPS = [
  { id: 1, label: 'Datos Generales' },
  { id: 2, label: 'Productos' },
  { id: 3, label: 'Alcance' },
  { id: 4, label: 'Regla Comercial' },
  { id: 5, label: 'Resumen' },
] as const;

const STEP_META: Record<number, { icon: React.ElementType; description: string }> = {
  1: { icon: FileText,     description: 'Laboratorio, titulo y vigencia de la promocion' },
  2: { icon: Package,      description: 'Productos que aplican a la promocion' },
  3: { icon: Users,        description: 'Clientes o segmentos objetivo' },
  4: { icon: Zap,          description: 'Tipo de beneficio y condiciones comerciales' },
  5: { icon: CheckCircle2, description: 'Revisa los datos y confirma la promocion' },
};

function normalizeOrigin(val: string | null | undefined): string | null {
  if (!val) return null;
  const lower = val.trim().toLowerCase();
  if (lower === 'dinamica comercial') return 'Dinamica comercial';
  if (lower === 'recurso propio') return 'Recurso propio';
  return val.trim();
}

export function PromotionFormSheet({
  open,
  onOpenChange,
  laboratories,
  onSuccess,
  editingPromo
}: PromotionFormSheetProps) {
  const isEditing = !!editingPromo;
  const { promoter, isPromoter } = usePromoter();

  const [approvalWarning, setApprovalWarning] = useState<string | null>(null);
  const [labId, setLabId] = useState('');
  const [origin, setOrigin] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [segment, setSegment] = useState('custom');
  const [scope, setScope] = useState('customers');
  const [selectedProductSkus, setSelectedProductSkus] = useState<string[]>([]);
  const [productApplicationMode, setProductApplicationMode] = useState('specific');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [productNameMap, setProductNameMap] = useState<Record<string, string>>({});
  const [customerNameMap, setCustomerNameMap] = useState<Record<string, string>>({});
  const [productFilterBrand, setProductFilterBrand] = useState('');
  const [productFilterExternalBrandId, setProductFilterExternalBrandId] = useState('');
  const [productFilterCategory, setProductFilterCategory] = useState('');
  const [productFilterSector, setProductFilterSector] = useState('');
  const [productFilterSpecies, setProductFilterSpecies] = useState('');
  const [productBrandOptions, setProductBrandOptions] = useState<string[]>([]);
  const [productCategoryOptions, setProductCategoryOptions] = useState<string[]>([]);
  const [productSectorOptions, setProductSectorOptions] = useState<string[]>([]);
  const [productSpeciesOptions, setProductSpeciesOptions] = useState<string[]>([]);
  const [customerFilterBusinessType, setCustomerFilterBusinessType] = useState('');
  const [customerFilterCity, setCustomerFilterCity] = useState('');
  const [customerFilterState, setCustomerFilterState] = useState('');
  const [customerFilterRepresentative, setCustomerFilterRepresentative] = useState('all');
  const [customerFilterLocation, setCustomerFilterLocation] = useState('all');
  const [customerFilterMinPurchases, setCustomerFilterMinPurchases] = useState('');
  const [customerFilterMaxPurchases, setCustomerFilterMaxPurchases] = useState('');
  const [customerFilterMinDays, setCustomerFilterMinDays] = useState('');
  const [customerFilterMaxDays, setCustomerFilterMaxDays] = useState('');
  const [customerBusinessTypeOptions, setCustomerBusinessTypeOptions] = useState<string[]>([]);
  const [customerClvOptions, setCustomerClvOptions] = useState<FilterOptionItem[]>([]);
  const [customerRfmOptions, setCustomerRfmOptions] = useState<FilterOptionItem[]>([]);
  const [customerFilterClv, setCustomerFilterClv] = useState('');
  const [customerFilterRfm, setCustomerFilterRfm] = useState('');
  const [customerRepresentativeOptions, setCustomerRepresentativeOptions] = useState<Array<[string, string]>>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productOptions, setProductOptions] = useState<ProductCatalogItem[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerRecord[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductCatalogItem[]>([]);
  const [loadingProductOptions, setLoadingProductOptions] = useState(false);
  const [loadingCustomerOptions, setLoadingCustomerOptions] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [loadingMoreCustomers, setLoadingMoreCustomers] = useState(false);
  const productListRef = useRef<HTMLDivElement>(null);
  const productOffsetRef = useRef(0);
  const customerOffsetRef = useRef(0);
  const productSearchRef = useRef('');
  const customerSearchRef = useRef('');
  const productOptionsHasMoreRef = useRef(false);
  const customerOptionsHasMoreRef = useRef(false);
  const [mechanicState, setMechanicState] = useState<PromotionMechanicFormState>(() => resetMechanicForPromotionType(''));
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const accountingTreatmentRef = useRef('descuento_pie');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMechanic, setIsLoadingMechanic] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [spendableBalance, setSpendableBalance] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const visibleProductOptions = productOptions.filter(
    (product) => !!product.product_sku && !selectedProductSkus.includes(product.product_sku),
  );
  const businessTypeSelectOptions = useMemo(
    () => customerBusinessTypeOptions.map((item) => ({ value: item, label: item })),
    [customerBusinessTypeOptions],
  );
  const representativeSelectOptions = useMemo(
    () => customerRepresentativeOptions.map(([value, label]) => ({ value, label })),
    [customerRepresentativeOptions],
  );
  const customerClvSelectOptions = useMemo(
    () => customerClvOptions.map((item) => ({ value: item.value, label: item.label })),
    [customerClvOptions],
  );
  const customerRfmSelectOptions = useMemo(
    () => customerRfmOptions.map((item) => ({ value: item.value, label: item.label })),
    [customerRfmOptions],
  );
  const productBrandSelectOptions = useMemo(
    () => productBrandOptions.map((item) => ({ value: item, label: item })),
    [productBrandOptions],
  );
  const productCategorySelectOptions = useMemo(
    () => productCategoryOptions.map((item) => ({ value: item, label: item })),
    [productCategoryOptions],
  );
  const productSectorSelectOptions = useMemo(
    () => productSectorOptions.map((item) => ({ value: item, label: item })),
    [productSectorOptions],
  );
  const productSpeciesSelectOptions = useMemo(
    () => productSpeciesOptions.map((item) => ({ value: item, label: item })),
    [productSpeciesOptions],
  );

  useEffect(() => {
    if (open && editingPromo) {
      const fetchPromotion = async () => {
        setCurrentStep(1);
        setIsLoadingMechanic(true);
        try {
          const details = await getPromotion(editingPromo.id);
          setLabId(details.lab_id);
          setOrigin(normalizeOrigin(details.origin) || '');
          setTitle(details.title);
          setDescription(details.description || '');
          setStartDate(details.start_date);
          setEndDate(details.end_date);
          const pf = (details.product_filters || {}) as Record<string, string>;
          const cf = (details.customer_filters || {}) as Record<string, unknown>;
          setSegment(String(cf.segment_preset || 'custom'));
          setScope(details.audience_scope || 'customers');
          setProductApplicationMode(details.product_mode || 'specific');
          const productSkus = details.product_skus || [];
          setSelectedProductSkus(productSkus);
          const customerIds = details.customer_ids || [];
          setSelectedCustomerIds(customerIds);
          if (productSkus.length > 0 || customerIds.length > 0) {
            Promise.all([getAllProducts(), getAllCustomers()]).then(([allProducts, allCustomers]) => {
              if (productSkus.length > 0) {
                const names: Record<string, string> = {};
                for (const sku of productSkus) {
                  const name = allProducts.find((p) => p.product_sku === sku)?.product_commercial_name?.trim() ?? '';
                  if (name) names[sku] = name;
                }
                if (Object.keys(names).length > 0) setProductNameMap((prev) => ({ ...prev, ...names }));
              }
              if (customerIds.length > 0) {
                const names: Record<string, string> = {};
                for (const nit of customerIds) {
                  const match = allCustomers.find((c) => String(c['customer_government_id'] ?? '') === nit);
                  names[nit] = match
                    ? String(match['customer_full_name'] ?? match['customer_name'] ?? '').trim() || nit
                    : nit;
                }
                setCustomerNameMap((prev) => ({ ...prev, ...names }));
              }
            });
          }
          setProductFilterBrand(String(pf.brand_name || ''));
          setProductFilterExternalBrandId(pf.external_brand_id ? String(pf.external_brand_id) : '');
          setProductFilterCategory(String(pf.category || ''));
          setProductFilterSector(String(pf.industry_sector || ''));
          setProductFilterSpecies(String(pf.target_species || ''));
          if (Array.isArray(pf.excluded_product_skus)) {
            setProdFilterState((s) => ({ ...s, filterExcludedSkus: pf.excluded_product_skus.map(String) }));
          }
          setCustomerFilterBusinessType(String(cf.business_type || ''));
          setCustomerFilterCity(String(cf.city || ''));
          setCustomerFilterState(String(cf.state || ''));
          setCustomerFilterRepresentative(
            typeof cf.sales_representative_id === 'number' || typeof cf.sales_representative_id === 'string'
              ? String(cf.sales_representative_id)
              : cf.has_sales_representative === true ? 'with'
                : cf.has_sales_representative === false ? WITHOUT_REPRESENTATIVE_OPTION
                  : 'all',
          );
          setCustomerFilterLocation(
            cf.has_location === true ? 'with'
              : cf.has_location === false ? 'without'
                : 'all',
          );
          setCustomerFilterMinPurchases(String(cf.min_purchases || ''));
          setCustomerFilterMaxPurchases(String(cf.max_purchases || ''));
          setCustomerFilterMinDays(String(cf.min_days_since_last_purchase || ''));
          setCustomerFilterMaxDays(String(cf.max_days_since_last_purchase || ''));
          setCustomerFilterClv(String(cf.customer_clv_segment || ''));
          setCustomerFilterRfm(String(cf.customer_rfm_segment || ''));
          if (Array.isArray(cf.excluded_customer_ids)) {
            setCustFilterState((s) => ({ ...s, customerExcludedIds: cf.excluded_customer_ids.map(String) }));
          }
          setEstimatedCost(details.estimated_cost || 0);
          setMaxRedemptions(details.max_redemptions || '');

          const mechanic = details.mechanic;
          if (mechanic) {
            setMechanicState(inferMechanicStateFromPromotion(mechanic));
            accountingTreatmentRef.current = mechanic.accounting_treatment || 'descuento_pie';
          }
        } catch (err) {
          console.error('Error loading promotion:', err);
          toast.error('Error al cargar la promocion');
        } finally {
          setIsLoadingMechanic(false);
        }
      };
      fetchPromotion();
    } else if (open && !editingPromo) {
      resetForm();
      if (isPromoter && promoter) {
        setLabId(promoter.laboratory_id);
      }
    }
  }, [open, editingPromo, isPromoter, promoter]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    Promise.allSettled([
      getCustomerFilterOptions(),
      getAllRepresentatives(),
      getProductFilterOptions(),
      listProducts({ limit: 500, offset: 0, is_catalog_verified: true, is_discontinued: false }),
    ]).then(([typesResult, repsResult, productFilterResult, productListResult]) => {
      if (cancelled) return;

      setCustomerBusinessTypeOptions(
        typesResult.status === 'fulfilled' && Array.isArray(typesResult.value.business_types)
          ? typesResult.value.business_types
          : [],
      );
      setCustomerClvOptions(
        typesResult.status === 'fulfilled' && Array.isArray(typesResult.value.clv_segments)
          ? typesResult.value.clv_segments
          : [],
      );
      setCustomerRfmOptions(
        typesResult.status === 'fulfilled' && Array.isArray(typesResult.value.rfm_segments)
          ? typesResult.value.rfm_segments
          : [],
      );
      setCustomerRepresentativeOptions(
        repsResult.status === 'fulfilled'
          ? [
            [WITHOUT_REPRESENTATIVE_OPTION, 'Sin representante'] as [string, string],
            ...repsResult.value
              .map(representativeOption)
            .filter((item): item is [string, string] => item !== null),
          ]
          : [],
      );

      setProductBrandOptions(
        productFilterResult.status === 'fulfilled' && Array.isArray(productFilterResult.value.brands)
          ? productFilterResult.value.brands
          : [],
      );
      setProductCategoryOptions(
        productFilterResult.status === 'fulfilled' && Array.isArray(productFilterResult.value.categories)
          ? productFilterResult.value.categories
          : [],
      );
      setProductSectorOptions(
        productFilterResult.status === 'fulfilled' && Array.isArray(productFilterResult.value.sectors)
          ? productFilterResult.value.sectors
          : [],
      );
      setProductSpeciesOptions(
        productFilterResult.status === 'fulfilled' && Array.isArray(productFilterResult.value.species)
          ? productFilterResult.value.species
          : [],
      );

      if (productListResult.status === 'fulfilled') {
        setCatalogProducts(productListResult.value);
        if (productFilterResult.status !== 'fulfilled' || !Array.isArray(productFilterResult.value.sectors)) {
          const sectors = Array.from(new Set(productListResult.value.flatMap((item) => { const s = String(item.product_industry_sector || '').trim(); return s ? [s] : []; }))).sort((a, b) => a.localeCompare(b));
          setProductSectorOptions(sectors);
        }
        if (productFilterResult.status !== 'fulfilled' || !Array.isArray(productFilterResult.value.species)) {
          const species = Array.from(new Set(productListResult.value.flatMap((item) => { const s = String(item.product_target_animal_species || '').trim(); return s ? [s] : []; }))).sort((a, b) => a.localeCompare(b));
          setProductSpeciesOptions(species);
        }
      } else if (productFilterResult.status !== 'fulfilled') {
        setCatalogProducts([]);
        setProductSectorOptions([]);
        setProductSpeciesOptions([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!isPromoter || !promoter || !open) {
      setApprovalWarning(null);
      return;
    }
    if (promoter.approval_limit !== null && estimatedCost > 0 && estimatedCost > promoter.approval_limit) {
      setApprovalWarning(
        `El costo estimado (${formatCurrency(estimatedCost)}) supera tu cupo de aprobacion (${formatCurrency(promoter.approval_limit)}). La promocion se guardara como "Requiere Aprobacion de Gerencia".`
      );
    } else {
      setApprovalWarning(null);
    }
  }, [estimatedCost, isPromoter, promoter, open]);

  useEffect(() => {
    if (!labId || !open) {
      setBudgetError(null);
      setSpendableBalance(null);
      return;
    }
    const checkBudget = async () => {
      try {
        const summary = await getPromotionBudget(labId, editingPromo?.id);
        setSpendableBalance(summary.spendable_balance);
        if (estimatedCost > 0 && estimatedCost > summary.spendable_balance) {
          setBudgetError(
            `Error: No puedes crear esta promocion. Estas excediendo el presupuesto de Marketing asignado. Saldo gastable disponible: ${formatCurrency(summary.spendable_balance)}`
          );
        } else {
          setBudgetError(null);
        }
      } catch (err) {
        console.error('Error checking budget:', err);
      }
    };
    checkBudget();
  }, [editingPromo?.id, labId, estimatedCost, open]);

  const PAGE = 10;

  useEffect(() => {
    if (!open) { setProductOptions([]); productOptionsHasMoreRef.current = false; return; }
    const term = productSearch.trim();
    if (term.length === 1) return;
    productSearchRef.current = term;
    productOffsetRef.current = 0;

    const timer = window.setTimeout(async () => {
      setLoadingProductOptions(true);
      try {
        const res = await listProducts({
          search: term || undefined,
          limit: PAGE,
          offset: 0,
          is_catalog_verified: true,
          is_discontinued: false,
        });
        setProductOptions(res.filter((p) => !!p.product_sku));
        productOptionsHasMoreRef.current = res.length === PAGE;
      } catch {
        setProductOptions([]);
        productOptionsHasMoreRef.current = false;
      } finally {
        setLoadingProductOptions(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, productSearch]);

  const loadMoreProducts = useCallback(async () => {
    if (loadingMoreProducts || !productOptionsHasMoreRef.current) return;
    const nextOffset = productOffsetRef.current + PAGE;
    productOffsetRef.current = nextOffset;
    setLoadingMoreProducts(true);
    try {
      const res = await listProducts({
        search: productSearchRef.current || undefined,
        limit: PAGE,
        offset: nextOffset,
        is_catalog_verified: true,
        is_discontinued: false,
      });
      setProductOptions((prev) => [...prev, ...res.filter((p) => !!p.product_sku)]);
      productOptionsHasMoreRef.current = res.length === PAGE;
    } catch {
      productOptionsHasMoreRef.current = false;
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [loadingMoreProducts]);

  useEffect(() => {
    if (!open || scope !== 'customers') { setCustomerOptions([]); customerOptionsHasMoreRef.current = false; return; }
    const term = customerSearch.trim();
    if (term.length === 1) return;
    customerSearchRef.current = term;
    customerOffsetRef.current = 0;

    const timer = window.setTimeout(async () => {
      setLoadingCustomerOptions(true);
      try {
        const res = await getCustomersPage({
          search: term || undefined,
          limit: PAGE,
          offset: 0,
          customer_is_valid: true,
          customer_is_frozen: false,
        });
        const data = (res.data ?? []).filter((c) => !!String(c['customer_government_id'] ?? ''));
        const total = listTotal(res);
        setCustomerOptions(data);
        customerOptionsHasMoreRef.current = total === null ? data.length === PAGE : data.length < total;
      } catch {
        setCustomerOptions([]);
        customerOptionsHasMoreRef.current = false;
      } finally {
        setLoadingCustomerOptions(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch, open, scope]);

  const loadMoreCustomers = useCallback(async () => {
    if (loadingMoreCustomers || !customerOptionsHasMoreRef.current) return;
    const nextOffset = customerOffsetRef.current + PAGE;
    customerOffsetRef.current = nextOffset;
    setLoadingMoreCustomers(true);
    try {
      const res = await getCustomersPage({
        search: customerSearchRef.current || undefined,
        limit: PAGE,
        offset: nextOffset,
        customer_is_valid: true,
        customer_is_frozen: false,
      });
      const data = res.data ?? [];
      const total = listTotal(res);
      setCustomerOptions((prev) => [...prev, ...data.filter((c) => !!String(c['customer_government_id'] ?? ''))]);
      customerOptionsHasMoreRef.current = total === null ? data.length === PAGE : customerOffsetRef.current + data.length < total;
    } catch {
      customerOptionsHasMoreRef.current = false;
    } finally {
      setLoadingMoreCustomers(false);
    }
  }, [loadingMoreCustomers]);

  const resetForm = () => {
    setLabId('');
    setOrigin('');
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setSegment('custom');
    setScope('customers');
    setSelectedProductSkus([]);
    setProductApplicationMode('specific');
    setSelectedCustomerIds([]);
    setProductFilterBrand('');
    setProductFilterExternalBrandId('');
    setProductFilterCategory('');
    setProductFilterSector('');
    setProductFilterSpecies('');
    setProductBrandOptions([]);
    setProductCategoryOptions([]);
    setProductSectorOptions([]);
    setProductSpeciesOptions([]);
    setCustomerFilterBusinessType('');
    setCustomerFilterCity('');
    setCustomerFilterState('');
    setCustomerFilterRepresentative('all');
    setCustomerFilterLocation('all');
    setCustomerFilterMinPurchases('');
    setCustomerFilterMaxPurchases('');
    setCustomerFilterMinDays('');
    setCustomerFilterMaxDays('');
    setCustomerFilterClv('');
    setCustomerFilterRfm('');
    setProductSearch('');
    setCustomerSearch('');
    setProductOptions([]);
    setCustomerOptions([]);
    productOptionsHasMoreRef.current = false;
    customerOptionsHasMoreRef.current = false;
    setProductNameMap({});
    setCustomerNameMap({});
    setMechanicState(resetMechanicForPromotionType(''));
    setEstimatedCost(0);
    accountingTreatmentRef.current = 'descuento_pie';
    setMaxRedemptions('');
    setBudgetError(null);
    setSpendableBalance(null);
    setApprovalWarning(null);
    setSubmitted(false);
    setCurrentStep(1);
  };

  // Debounced product filter state
  const [debouncedProdFilters, setDebouncedProdFilters] = useState({ brand: '', sector: '', category: '', species: '', external_brand_id: '' });
  const [prodFilterState, setProdFilterState] = useState<{ productFilterCount: number | null; productFilterFetching: boolean; productFilterResults: ProductCatalogItem[]; showFilteredProducts: boolean; filterExcludedSkus: string[]; }>({ productFilterCount: null, productFilterFetching: false, productFilterResults: [], showFilteredProducts: false, filterExcludedSkus: [] });
  const { productFilterCount, productFilterFetching, productFilterResults, showFilteredProducts, filterExcludedSkus } = prodFilterState;
  const [filterResultsSearch, setFilterResultsSearch] = useState('');
  const [customerResultsSearch, setCustomerResultsSearch] = useState('');
  const [showSelectedProducts, setShowSelectedProducts] = useState(false);
  const [debouncedCustFilters, setDebouncedCustFilters] = useState<Record<string, unknown>>({});
  const [custFilterState, setCustFilterState] = useState<{ customerFilterCount: number | null; customerFilterFetching: boolean; customerFilterResults: CustomerRecord[]; showFilteredCustomers: boolean; customerExcludedIds: string[]; }>({ customerFilterCount: null, customerFilterFetching: false, customerFilterResults: [], showFilteredCustomers: false, customerExcludedIds: [] });
  const { customerFilterCount, customerFilterFetching, customerFilterResults, showFilteredCustomers, customerExcludedIds } = custFilterState;
  const [showSelectedCustomers, setShowSelectedCustomers] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProdFilters({
      brand: productFilterBrand, sector: productFilterSector,
      category: productFilterCategory, species: productFilterSpecies,
      external_brand_id: productFilterExternalBrandId,
    }), 600);
    return () => clearTimeout(t);
  }, [productFilterBrand, productFilterSector, productFilterCategory, productFilterSpecies, productFilterExternalBrandId]);

  useEffect(() => {
    const anyFilter = debouncedProdFilters.brand || debouncedProdFilters.sector || debouncedProdFilters.category || debouncedProdFilters.species || debouncedProdFilters.external_brand_id;
    if (productApplicationMode !== 'filters' || !anyFilter) { setProdFilterState((s) => ({ ...s, productFilterCount: null, productFilterResults: [], showFilteredProducts: false, filterExcludedSkus: [] })); return; }
    setProdFilterState((s) => ({ ...s, productFilterFetching: true, filterExcludedSkus: [] }));
    listProducts({
      brand_name: debouncedProdFilters.brand || undefined,
      external_brand_id: debouncedProdFilters.external_brand_id ? Number(debouncedProdFilters.external_brand_id) : undefined,
      industry_sector: debouncedProdFilters.sector || undefined,
      category: debouncedProdFilters.category || undefined,
      target_species: debouncedProdFilters.species || undefined,
      is_catalog_verified: true,
      is_discontinued: false,
      limit: 2000,
    }).then((r) => { const valid = r.filter((p) => !!p.product_sku); setProdFilterState((s) => ({ ...s, productFilterCount: valid.length, productFilterResults: valid })); }).catch(() => { setProdFilterState((s) => ({ ...s, productFilterCount: null, productFilterResults: [] })); }).finally(() => setProdFilterState((s) => ({ ...s, productFilterFetching: false })));
  }, [debouncedProdFilters, productApplicationMode]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCustFilters({
      business_type: customerFilterBusinessType || undefined,
      city: customerFilterCity || undefined,
      state: customerFilterState || undefined,
      has_sales_representative: customerFilterRepresentative === 'with' ? true : customerFilterRepresentative === WITHOUT_REPRESENTATIVE_OPTION ? false : undefined,
      sales_representative_id: (customerFilterRepresentative !== 'with' && customerFilterRepresentative !== WITHOUT_REPRESENTATIVE_OPTION && customerFilterRepresentative !== 'all') ? Number(customerFilterRepresentative) : undefined,
      has_location: customerFilterLocation === 'with' ? true : customerFilterLocation === 'without' ? false : undefined,
      min_purchases: customerFilterMinPurchases ? Number(customerFilterMinPurchases) : undefined,
      max_purchases: customerFilterMaxPurchases ? Number(customerFilterMaxPurchases) : undefined,
      min_days_since_last_purchase: customerFilterMinDays ? Number(customerFilterMinDays) : undefined,
      max_days_since_last_purchase: customerFilterMaxDays ? Number(customerFilterMaxDays) : undefined,
      customer_clv_segment: customerFilterClv || undefined,
      customer_rfm_segment: customerFilterRfm || undefined,
    }), 600);
    return () => clearTimeout(t);
  }, [customerFilterBusinessType, customerFilterCity, customerFilterState, customerFilterRepresentative,
    customerFilterLocation, customerFilterMinPurchases, customerFilterMaxPurchases,
    customerFilterMinDays, customerFilterMaxDays, customerFilterClv, customerFilterRfm]);

  useEffect(() => {
    const isManual = scope === 'customer_segment' && segment === 'custom';
    const anyFilter = Object.values(debouncedCustFilters).some((v) => v != null);
    if (!isManual || !anyFilter) { setCustFilterState((s) => ({ ...s, customerFilterCount: null, customerFilterResults: [], showFilteredCustomers: false, customerExcludedIds: [] })); return; }
    setCustFilterState((s) => ({ ...s, customerFilterFetching: true, customerExcludedIds: [] }));
    getCustomersPage({ ...debouncedCustFilters, limit: 2000 })
      .then((res) => { const valid = (res.data ?? []).filter((c) => !!String(c['customer_government_id'] ?? '')); setCustFilterState((s) => ({ ...s, customerFilterCount: valid.length, customerFilterResults: valid })); })
      .catch(() => { setCustFilterState((s) => ({ ...s, customerFilterCount: null, customerFilterResults: [] })); })
      .finally(() => setCustFilterState((s) => ({ ...s, customerFilterFetching: false })));
  }, [debouncedCustFilters, scope, segment]);

  useEffect(() => {
    if (scope !== 'customer_segment' || segment === 'custom') { return; }
    const presetFilters = buildSegmentPresetConfig(segment);
    setCustFilterState((s) => ({ ...s, customerFilterCount: null, customerFilterResults: [], showFilteredCustomers: false, customerFilterFetching: true }));
    getCustomersPage({ ...presetFilters, limit: 2000 })
      .then((res) => { const valid = (res.data ?? []).filter((c) => !!String(c['customer_government_id'] ?? '')); setCustFilterState((s) => ({ ...s, customerFilterCount: valid.length, customerFilterResults: valid })); })
      .catch(() => { setCustFilterState((s) => ({ ...s, customerFilterCount: null, customerFilterResults: [] })); })
      .finally(() => setCustFilterState((s) => ({ ...s, customerFilterFetching: false })));
  }, [scope, segment]);

  const hasProductFilters = Boolean(productFilterBrand || productFilterExternalBrandId || productFilterSector || productFilterCategory || productFilterSpecies);
  const hasCustomerFilters = Boolean(
    customerFilterBusinessType || customerFilterCity || customerFilterState
    || customerFilterRepresentative !== 'all' || customerFilterLocation !== 'all'
    || customerFilterMinPurchases || customerFilterMaxPurchases
    || customerFilterMinDays || customerFilterMaxDays
    || customerFilterClv || customerFilterRfm,
  );

  const formErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!labId) errors.labId = 'Selecciona un laboratorio';
    if (!origin) errors.origin = 'Selecciona el origen de la promocion';
    if (!title.trim()) errors.title = 'Ingresa un titulo para la promocion';
    else if (/[%\[\]{}<>@#&*^~`\\|]/.test(title.trim())) errors.title = 'El título no puede contener caracteres especiales (%, [, ], {, }, @, etc.)';
    const today = new Date().toISOString().split('T')[0];
    if (!startDate || !endDate) errors.dates = 'Selecciona las fechas de vigencia';
    else if (startDate < today) errors.dates = 'La fecha de inicio no puede ser anterior a hoy';
    else if (endDate < today) errors.dates = 'La fecha de fin no puede ser anterior a hoy';
    else if (startDate > endDate) errors.dates = 'La fecha inicio debe ser anterior a la de fin';
    if (productApplicationMode === 'specific' && selectedProductSkus.length === 0)
      errors.products = 'Selecciona al menos un producto';
    if (productApplicationMode === 'filters' && !hasProductFilters)
      errors.products = 'Define al menos un filtro de marca, sector, categoria o especie';
    if (productApplicationMode === 'filters' && hasProductFilters && productFilterFetching)
      errors.products = 'Esperando resultados del filtro de productos…';
    if (productApplicationMode === 'filters' && hasProductFilters && !productFilterFetching && productFilterCount === null)
      errors.products = 'Aplica el filtro para ver los productos antes de continuar';
    if (productApplicationMode === 'filters' && hasProductFilters && !productFilterFetching && productFilterCount === 0)
      errors.products = 'No hay productos que coincidan con estos filtros';
    if (scope === 'customers' && selectedCustomerIds.length === 0)
      errors.scope = 'Selecciona al menos un cliente para este alcance';
    if (scope === 'customer_segment' && segment === 'custom' && !hasCustomerFilters)
      errors.scope = 'Define al menos un filtro para el segmento de clientes';
    if (scope === 'customer_segment' && segment === 'custom' && hasCustomerFilters && customerFilterCount === 0)
      errors.scope = 'No hay clientes que coincidan con estos filtros';
    const mechanicError = validatePromotionMechanic(mechanicState);
    if (mechanicError) errors.mechanic = mechanicError;
    return errors;
  }, [labId, origin, title, startDate, endDate, productApplicationMode, selectedProductSkus,
    hasProductFilters, productFilterCount, productFilterFetching, scope, selectedCustomerIds, segment,
    hasCustomerFilters, customerFilterCount, mechanicState]);

  const buildTargetConfig = useMemo(() => {
    return () => {
      const productFilters = productApplicationMode === 'filters'
        ? {
          brand_name: productFilterBrand || undefined,
          external_brand_id: productFilterExternalBrandId ? Number(productFilterExternalBrandId) : undefined,
          industry_sector: productFilterSector || undefined,
          category: productFilterCategory || undefined,
          target_species: productFilterSpecies || undefined,
        }
        : undefined;

      if (scope === 'all') {
        return {
          preset: 'commercial_base',
          has_sales_representative: true,
          min_purchases: 1,
          product_filter_mode: productApplicationMode,
          product_filters: productFilters,
        };
      }
      const target: Record<string, unknown> = {};
      target.product_filter_mode = productApplicationMode;
      target.product_filters = productFilters;
      if (scope === 'customers') {
        target.customer_ids = selectedCustomerIds;
      }
      if (scope === 'customer_segment') {
        Object.assign(target, buildSegmentPresetConfig(segment));
        if (segment !== 'custom') {
          target.segment_preset = segment;
        }
        target.business_type = customerFilterBusinessType === 'all' ? undefined : customerFilterBusinessType || undefined;
        target.city = customerFilterCity || undefined;
        target.state = customerFilterState || undefined;
        target.has_sales_representative =
          customerFilterRepresentative === 'with' ? true
            : customerFilterRepresentative === WITHOUT_REPRESENTATIVE_OPTION ? false
              : customerFilterRepresentative !== 'all' ? true
                : undefined;
        target.sales_representative_id =
          customerFilterRepresentative !== 'all' && customerFilterRepresentative !== 'with' && customerFilterRepresentative !== WITHOUT_REPRESENTATIVE_OPTION
            ? Number(customerFilterRepresentative)
            : undefined;
        target.has_location =
          customerFilterLocation === 'with' ? true
            : customerFilterLocation === 'without' ? false
              : undefined;
        target.min_purchases = customerFilterMinPurchases ? Number(customerFilterMinPurchases) : undefined;
        target.max_purchases = customerFilterMaxPurchases ? Number(customerFilterMaxPurchases) : undefined;
        target.min_days_since_last_purchase = customerFilterMinDays ? Number(customerFilterMinDays) : undefined;
        target.max_days_since_last_purchase = customerFilterMaxDays ? Number(customerFilterMaxDays) : undefined;
        target.customer_clv_segment = customerFilterClv || undefined;
        target.customer_rfm_segment = customerFilterRfm || undefined;
      }
      return target;
    };
  }, [
    buildSegmentPresetConfig,
    customerFilterBusinessType,
    customerFilterCity,
    customerFilterClv,
    customerFilterLocation,
    customerFilterMaxDays,
    customerFilterMaxPurchases,
    customerFilterMinDays,
    customerFilterMinPurchases,
    customerFilterRepresentative,
    customerFilterRfm,
    customerFilterState,
    productApplicationMode,
    productFilterBrand,
    productFilterCategory,
    productFilterExternalBrandId,
    productFilterSector,
    productFilterSpecies,
    scope,
    segment,
    selectedCustomerIds,
  ]);

  const productSelectOptions = useMemo(
    () =>
      catalogProducts.map((product) => ({
        value: product.product_sku,
        label: `${product.product_commercial_name || product.product_sku} (${product.product_sku})`,
      })),
    [catalogProducts],
  );

  const productLabelBySku = useCallback(
    (sku: string | null | undefined) =>
      catalogProducts.find((product) => product.product_sku === sku)?.product_commercial_name
      || productNameMap[sku || '']
      || sku
      || '',
    [catalogProducts, productNameMap],
  );

  const selectedProductOptions = useMemo(
    () =>
      selectedProductSkus.map((sku) => ({
        value: sku,
        label: productLabelBySku(sku) || sku,
      })),
    [selectedProductSkus, productLabelBySku],
  );

  const updateMechanic = useCallback((patch: Partial<PromotionMechanicFormState['mechanic']>) => {
    setMechanicState((prev) => ({
      ...prev,
      mechanic: {
        ...prev.mechanic,
        ...patch,
      },
    }));
  }, []);

  const setPromotionType = useCallback((value: string) => {
    setMechanicState(resetMechanicForPromotionType(value as PromotionMechanicFormState['promotionType']));
  }, []);

  const setRequiredProducts = useCallback((required_products: RequiredPromotionProduct[]) => {
    updateMechanic({ required_products });
  }, [updateMechanic]);

  const addRequiredProduct = useCallback(() => {
    setRequiredProducts([...(mechanicState.mechanic.required_products || []), createRequiredProduct()]);
  }, [mechanicState.mechanic.required_products, setRequiredProducts]);

  const updateRequiredProduct = useCallback((index: number, patch: Partial<RequiredPromotionProduct>) => {
    const next = [...(mechanicState.mechanic.required_products || [])];
    next[index] = { ...next[index], ...patch };
    setRequiredProducts(next);
  }, [mechanicState.mechanic.required_products, setRequiredProducts]);

  const removeRequiredProduct = useCallback((index: number) => {
    const next = [...(mechanicState.mechanic.required_products || [])];
    next.splice(index, 1);
    setRequiredProducts(next);
  }, [mechanicState.mechanic.required_products, setRequiredProducts]);

  const addProductSku = (sku: string, name?: string) => {
    if (!sku || selectedProductSkus.includes(sku)) return;
    if (name) setProductNameMap((prev) => ({ ...prev, [sku]: name }));
    setSelectedProductSkus((prev) => [...prev, sku]);
  };

  const addCustomerId = (id: string, name?: string) => {
    if (!id || selectedCustomerIds.includes(id)) return;
    if (name) setCustomerNameMap((prev) => ({ ...prev, [id]: name }));
    setSelectedCustomerIds((prev) => [...prev, id]);
  };

  const handleSubmit = async () => {
    if (Object.keys(formErrors).length > 0) {
      setSubmitted(true);
      toast.error('Revisa los campos marcados en rojo');
      return;
    }
    if (budgetError) {
      toast.error('No puedes guardar: el costo estimado supera el presupuesto gastable disponible.');
      return;
    }

    setIsSubmitting(true);
    try {
      const mechanicPayload = buildPromotionMechanicPayload({
        ...mechanicState,
        mechanic: {
          ...mechanicState.mechanic,
          base_product_name: productLabelBySku(mechanicState.mechanic.base_product_id),
          bonus_product_name: productLabelBySku(mechanicState.mechanic.bonus_product_id),
          special_price_product_name: productLabelBySku(mechanicState.mechanic.special_price_product_id),
          required_products: (mechanicState.mechanic.required_products || []).map((item) => ({
            ...item,
            product_name: productLabelBySku(item.product_id),
          })),
        },
      });
      mechanicPayload.accounting_treatment = accountingTreatmentRef.current;

      const buildCustomerFilters = () => {
        if (scope !== 'customer_segment') return null;
        if (segment !== 'custom') return {
          ...buildSegmentPresetConfig(segment),
          segment_preset: segment,
          ...(customerExcludedIds.length > 0 ? { excluded_customer_ids: customerExcludedIds } : {}),
        };
        const raw: Record<string, unknown> = {
          business_type: customerFilterBusinessType || undefined,
          city: customerFilterCity || undefined,
          state: customerFilterState || undefined,
          has_sales_representative: customerFilterRepresentative === 'with' ? true : customerFilterRepresentative === WITHOUT_REPRESENTATIVE_OPTION ? false : undefined,
          sales_representative_id: (customerFilterRepresentative !== 'with' && customerFilterRepresentative !== WITHOUT_REPRESENTATIVE_OPTION && customerFilterRepresentative !== 'all') ? Number(customerFilterRepresentative) : undefined,
          has_location: customerFilterLocation === 'with' ? true : customerFilterLocation === 'without' ? false : undefined,
          min_purchases: customerFilterMinPurchases ? Number(customerFilterMinPurchases) : undefined,
          max_purchases: customerFilterMaxPurchases ? Number(customerFilterMaxPurchases) : undefined,
          min_days_since_last_purchase: customerFilterMinDays ? Number(customerFilterMinDays) : undefined,
          max_days_since_last_purchase: customerFilterMaxDays ? Number(customerFilterMaxDays) : undefined,
          customer_clv_segment: customerFilterClv || undefined,
          customer_rfm_segment: customerFilterRfm || undefined,
          excluded_customer_ids: customerExcludedIds.length > 0 ? customerExcludedIds : undefined,
        };
        return Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
      };
      const customerFilters = buildCustomerFilters();

      const productFiltersPayload = productApplicationMode === 'filters'
        ? {
          brand_name: productFilterBrand || undefined,
          external_brand_id: productFilterExternalBrandId ? Number(productFilterExternalBrandId) : undefined,
          industry_sector: productFilterSector || undefined,
          category: productFilterCategory || undefined,
          target_species: productFilterSpecies || undefined,
          excluded_product_skus: filterExcludedSkus.length > 0 ? filterExcludedSkus : undefined,
        }
        : undefined;

      const payload = {
        lab_id: labId,
        origin: origin || null,
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        product_application_mode: productApplicationMode,
        product_skus: productApplicationMode === 'specific'
          ? selectedProductSkus
          : productFilterResults.filter((p) => !filterExcludedSkus.includes(p.product_sku)).map((p) => p.product_sku),
        product_filters: productFiltersPayload,
        target_scope: scope as 'all' | 'customers' | 'customer_segment',
        customer_ids: scope === 'customers'
          ? selectedCustomerIds
          : scope === 'customer_segment'
            ? customerFilterResults
                .filter((c) => {
                  const nit = String(c['customer_government_id'] ?? '');
                  return nit && !customerExcludedIds.includes(nit);
                })
                .map((c) => String(c['customer_government_id']))
            : undefined,
        customer_filters: customerFilters,
        target_config: buildTargetConfig(),
        estimated_cost: estimatedCost || null,
        max_redemptions: maxRedemptions || null,
        created_by_role: isPromoter ? ('laboratorio' as const) : ('distribuidor' as const),
        mechanic: mechanicPayload,
      };

      const result = isEditing && editingPromo
        ? await updatePromotion(editingPromo.id, payload)
        : await createPromotion(payload);

      if (result.sap_sync_error && result.status === 'activa') {
        // Backend activó pero SAP falló — revertir a borrador
        await updatePromotionStatus(result.id, 'borrador');
        toast.warning(isEditing ? 'No se pudo activar — error SAP' : 'Promoción creada como borrador — error SAP', {
          description: result.sap_sync_error,
          duration: 10000,
        });
      } else if (result.sap_sync_error) {
        toast.warning(isEditing ? 'Guardada con advertencia SAP' : 'Creada con advertencia SAP', {
          description: result.sap_sync_error,
          duration: 10000,
        });
      } else if (result.requires_manager_approval) {
        toast.success('Promocion creada - Requiere Aprobacion de Gerencia');
      } else {
        toast.success(isEditing ? 'Promocion actualizada exitosamente' : 'Promocion creada exitosamente');
      }

      resetForm();
      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => COP_FORMATTER.format(value);

  const mechanicSummary = useMemo(() => summarizePromotionMechanic(mechanicState), [mechanicState]);

  const stepHasErrors = (step: number): boolean => {
    if (step === 1) return !!(formErrors.labId || formErrors.origin || formErrors.title || formErrors.dates);
    if (step === 2) return !!formErrors.products;
    if (step === 3) return !!formErrors.scope;
    if (step === 4) return !!formErrors.mechanic;
    return false;
  };

  const goNext = () => {
    if (currentStep < 5) {
      setCurrentStep((s) => s + 1);
    } else {
      setSubmitted(true);
      if (Object.keys(formErrors).length > 0) {
        toast.error('Revisa los pasos marcados en rojo');
        return;
      }
      handleSubmit();
    }
  };

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:h-[90dvh] sm:max-h-[900px] sm:max-w-[700px] sm:rounded-xl ${formFocusClasses}`}>
        {/* HEADER */}
        <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-4 pr-12 text-left sm:px-6 sm:pb-4 sm:pt-5 sm:pr-14">
          <div className="pb-2 sm:pb-3">
            <DialogTitle className="text-base font-semibold sm:text-xl">
              {isEditing ? 'Editar Promocion' : 'Nueva Promocion'}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-left text-xs text-muted-foreground">
              {isEditing ? 'Modifica los datos de la promocion' : 'Completa cada paso para crear la promocion'}
            </DialogDescription>
          </div>
          <div className="pt-1">
            <div className="flex items-start">
              {STEPS.map((step, idx) => {
                const isActive = step.id === currentStep;
                const isDone = step.id < currentStep;
                const hasError = submitted && stepHasErrors(step.id);
                return (
                  <Fragment key={step.id}>
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(step.id)}
                        title={step.label}
                        className={[
                          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all cursor-pointer hover:opacity-80 sm:size-9 sm:text-sm',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                            : hasError
                            ? 'bg-destructive/15 text-destructive ring-1 ring-destructive/40'
                            : isDone
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground',
                        ].join(' ')}
                      >
                        {hasError ? '!' : (isDone ? <Check className="size-3 sm:size-3.5" /> : step.id)}
                      </button>
                      <span className={[
                        'hidden text-[9px] font-medium whitespace-nowrap leading-tight sm:block sm:text-[10px]',
                        isActive ? 'text-primary' : hasError ? 'text-destructive' : isDone ? 'text-primary/70' : 'text-muted-foreground/70',
                      ].join(' ')}>
                        {step.label}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`mx-1 mt-3.5 h-px flex-1 transition-all sm:mx-1.5 sm:mt-[18px] ${step.id < currentStep ? 'bg-primary/40' : 'bg-muted-foreground/20'}`} />
                    )}
                  </Fragment>
                );
              })}
            </div>
            {/* Mobile: show active step name below circles */}
            <div className="mt-1.5 sm:hidden">
              <span className="text-[11px] font-semibold text-primary">{STEPS[currentStep - 1].label}</span>
              <span className="ml-1 text-[11px] text-muted-foreground">· {currentStep}/{STEPS.length}</span>
            </div>
          </div>
        </DialogHeader>

        {/* STATIC STEP TITLE — always visible, never scrolls */}
        <div className="shrink-0 border-b bg-muted/20 px-4 py-3 sm:px-6">
          <StepHeader step={currentStep} />
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {isLoadingMechanic ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando datos…</span>
            </div>
          ) : (
            <>
              {/* STEP 1: Datos Generales */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="laboratory" className="font-medium">Laboratorio <span className="text-destructive">*</span></Label>
                      {isPromoter ? (
                        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5">
                          <span className="text-sm font-medium">{laboratories.find((l) => l.id === labId)?.name || 'Laboratorio asignado'}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Asignado</span>
                        </div>
                      ) : (
                        <div className={submitted && formErrors.labId ? 'rounded-md ring-1 ring-destructive' : ''}>
                          <SearchableSelect
                            value={labId || 'all'}
                            onValueChange={(v) => setLabId(v === 'all' ? '' : v)}
                            options={laboratories.map((lab) => ({ value: lab.id, label: lab.name }))}
                            allLabel="Selecciona un laboratorio"
                            searchPlaceholder="Buscar laboratorio..."
                            emptyLabel="Sin resultados"
                          />
                        </div>
                      )}
                      {submitted && <FieldError error={formErrors.labId} />}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium">Origen <span className="text-destructive">*</span></Label>
                      <Select value={origin} onValueChange={setOrigin}>
                        <SelectTrigger className={submitted && formErrors.origin ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Selecciona el origen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dinamica comercial">Dinamica comercial</SelectItem>
                          <SelectItem value="Recurso propio">Recurso propio</SelectItem>
                        </SelectContent>
                      </Select>
                      {submitted && <FieldError error={formErrors.origin} />}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title" className="font-medium">Titulo de la Promocion <span className="text-destructive">*</span></Label>
                      <Input id="title" placeholder="Ej: BONIFICADO 10+1, DESCUENTO 7" value={title} onChange={(e) => setTitle(e.target.value)} className={submitted && formErrors.title ? 'border-destructive' : ''} />
                      {submitted && <FieldError error={formErrors.title} />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Vigencia de la Promocion <span className="text-destructive">*</span></Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted-foreground">Fecha inicio</span>
                        <Input id="startDate" type="date" value={startDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setStartDate(e.target.value)} className={submitted && formErrors.dates ? 'border-destructive' : ''} />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted-foreground">Fecha fin</span>
                        <Input id="endDate" type="date" value={endDate} min={startDate || new Date().toISOString().split('T')[0]} onChange={(e) => setEndDate(e.target.value)} className={submitted && formErrors.dates ? 'border-destructive' : ''} />
                      </div>
                    </div>
                    {submitted && <FieldError error={formErrors.dates} />}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="font-medium">
                      Descripcion{' '}
                      <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Textarea id="description" placeholder="Descripcion detallada de la promocion…" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="resize-none" />
                  </div>
                </div>
              )}

              {/* STEP 2: Productos */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="font-medium">Aplica a <span className="text-destructive">*</span></Label>
                    <Select value={productApplicationMode} onValueChange={setProductApplicationMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_APPLICATION_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {productApplicationMode === 'specific' ? (
                    <div className="space-y-2">
                      {/* Search input */}
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
                        {loadingProductOptions
                          ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                          : <Search className="size-4 shrink-0 text-muted-foreground" />}
                        <input
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Buscar productos por SKU, nombre o marca"
                        />
                        {productSearch && (
                          <button type="button" onClick={() => { setProductSearch(''); setProductOptions([]); }} className="text-muted-foreground transition-colors hover:text-destructive">
                            <X className="size-4" />
                          </button>
                        )}
                      </div>

                      {/* Search results dropdown */}
                      {visibleProductOptions.length > 0 && (
                        <div
                          ref={productListRef}
                          className="max-h-56 overflow-y-auto rounded-md border divide-y"
                          onScroll={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) loadMoreProducts();
                          }}
                        >
                          {visibleProductOptions.map((product) => (
                            <button
                              key={product.product_sku}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                              onClick={() => addProductSku(product.product_sku, product.product_commercial_name || product.product_sku)}
                            >
                              <span className="min-w-0 truncate">{product.product_commercial_name || product.product_sku}</span>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">{product.product_sku}</span>
                            </button>
                          ))}
                          {loadingMoreProducts && <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Cargando más…</div>}
                        </div>
                      )}

                      {/* Selected products card */}
                      <div className={cn("rounded-lg border", selectedProductSkus.length === 0 && "border-dashed")}>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Package className={cn("size-4 shrink-0", selectedProductSkus.length === 0 ? "text-muted-foreground/50" : "text-primary")} />
                            <span className={cn("text-sm font-medium", selectedProductSkus.length === 0 && "text-muted-foreground")}>
                              {selectedProductSkus.length === 0
                                ? 'Sin productos seleccionados'
                                : `${selectedProductSkus.length} producto${selectedProductSkus.length !== 1 ? 's' : ''} seleccionado${selectedProductSkus.length !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          {selectedProductSkus.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowSelectedProducts((v) => !v)}
                              className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                            >
                              {showSelectedProducts ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                              {showSelectedProducts ? 'Ocultar' : 'Ver'}
                            </button>
                          )}
                        </div>
                        {showSelectedProducts && selectedProductSkus.length > 0 && (
                          <div className="divide-y border-t">
                            {selectedProductSkus.map((sku) => (
                              <div key={sku} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                <span className="min-w-0 truncate">{productLabelBySku(sku) || sku}</span>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">{sku}</span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedProductSkus((prev) => prev.filter((item) => item !== sku))}
                                    className="text-muted-foreground transition-colors hover:text-destructive"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <SlidersHorizontal className="size-4 text-primary" />
                        <span className="flex-1">Filtros de productos</span>
                        {hasProductFilters && (
                          <button type="button" onClick={() => { setProductFilterBrand(''); setProductFilterExternalBrandId(''); setProductFilterSector(''); setProductFilterCategory(''); setProductFilterSpecies(''); setProdFilterState((s) => ({ ...s, productFilterCount: null, productFilterResults: [], showFilteredProducts: false, filterExcludedSkus: [] })); }} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                            <X className="size-3" />Limpiar
                          </button>
                        )}
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Marca</Label>
                            <SearchableSelect value={productFilterBrand || 'all'} onValueChange={(value) => setProductFilterBrand(value === 'all' ? '' : value)} options={productBrandSelectOptions} allLabel="Todas las marcas" searchPlaceholder="Buscar marca…" emptyLabel="No hay marcas" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Sector</Label>
                            <SearchableSelect value={productFilterSector || 'all'} onValueChange={(value) => setProductFilterSector(value === 'all' ? '' : value)} options={productSectorSelectOptions} allLabel="Todos los sectores" searchPlaceholder="Buscar sector…" emptyLabel="No hay sectores" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                            <SearchableSelect value={productFilterCategory || 'all'} onValueChange={(value) => setProductFilterCategory(value === 'all' ? '' : value)} options={productCategorySelectOptions} allLabel="Todas las categorias" searchPlaceholder="Buscar categoria…" emptyLabel="No hay categorias" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Especie</Label>
                            <SearchableSelect value={productFilterSpecies || 'all'} onValueChange={(value) => setProductFilterSpecies(value === 'all' ? '' : value)} options={productSpeciesSelectOptions} allLabel="Todas las especies" searchPlaceholder="Buscar especie…" emptyLabel="No hay especies" />
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const effectiveCount = (productFilterCount ?? 0) - filterExcludedSkus.length;
                        const isZero = hasProductFilters && !productFilterFetching && productFilterCount !== null && effectiveCount === 0;
                        const searchTerm = filterResultsSearch.trim().toLowerCase();
                        const included = productFilterResults.filter((p) => !filterExcludedSkus.includes(p.product_sku));
                        const excluded = productFilterResults.filter((p) => filterExcludedSkus.includes(p.product_sku));
                        const allSorted = [...included, ...excluded];
                        const displayedResults = searchTerm
                          ? allSorted.filter((p) => (p.product_commercial_name || p.product_sku).toLowerCase().includes(searchTerm) || p.product_sku.toLowerCase().includes(searchTerm))
                          : allSorted;
                        return (
                          <div className={cn("rounded-lg border", !hasProductFilters && "border-dashed")}>
                            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                {productFilterFetching
                                  ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                                  : <SlidersHorizontal className={cn("size-4 shrink-0", !hasProductFilters ? "text-muted-foreground/50" : isZero ? "text-destructive" : "text-primary")} />}
                                <span className={cn(
                                  "text-sm font-medium",
                                  !hasProductFilters || productFilterCount === null ? "text-muted-foreground" :
                                  isZero ? "text-destructive" : "",
                                )}>
                                  {!hasProductFilters
                                    ? 'Sin filtros seleccionados'
                                    : productFilterFetching
                                    ? 'Buscando productos...'
                                    : productFilterCount === null
                                    ? 'Aplica los filtros para ver resultados'
                                    : isZero
                                    ? 'Sin productos para estos filtros'
                                    : `${effectiveCount} incluido${effectiveCount !== 1 ? 's' : ''}${filterExcludedSkus.length > 0 ? ` · ${filterExcludedSkus.length} excluido${filterExcludedSkus.length !== 1 ? 's' : ''}` : ''}`}
                                </span>
                              </div>
                              {!productFilterFetching && hasProductFilters && productFilterCount !== null && productFilterResults.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => { setProdFilterState((s) => ({ ...s, showFilteredProducts: !s.showFilteredProducts })); setFilterResultsSearch(''); }}
                                  className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm hover:bg-muted/50 hover:text-foreground"
                                >
                                  {showFilteredProducts ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                  {showFilteredProducts ? 'Ocultar' : 'Ver'}
                                </button>
                              )}
                            </div>
                            {showFilteredProducts && productFilterResults.length > 0 && (
                              <div className="border-t">
                                {allSorted.length > 10 && (
                                  <div className="flex items-center gap-2 border-b px-3 py-2.5">
                                    <Search className="size-4 shrink-0 text-muted-foreground" />
                                    <input
                                      className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                      placeholder="Buscar en resultados..."
                                      value={filterResultsSearch}
                                      onChange={(e) => setFilterResultsSearch(e.target.value)}
                                    />
                                    {filterResultsSearch && <button type="button" onClick={() => setFilterResultsSearch('')}><X className="size-4 text-muted-foreground hover:text-foreground" /></button>}
                                  </div>
                                )}
                                <div className="max-h-72 overflow-y-auto divide-y">
                                  {displayedResults.map((p) => {
                                    const isExcluded = filterExcludedSkus.includes(p.product_sku);
                                    return (
                                      <div key={p.product_sku} className={cn("flex items-center justify-between gap-3 px-3 py-2.5 text-sm", isExcluded && "opacity-50")}>
                                        <span className={cn("min-w-0 truncate", isExcluded && "line-through")}>{p.product_commercial_name || p.product_sku}</span>
                                        <div className="flex shrink-0 items-center gap-2">
                                          <span className="font-mono text-xs text-muted-foreground">{p.product_sku}</span>
                                          {isExcluded ? (
                                            <button type="button" title="Volver a incluir" onClick={() => setProdFilterState((st) => ({ ...st, filterExcludedSkus: st.filterExcludedSkus.filter((s) => s !== p.product_sku) }))} className="text-muted-foreground hover:text-primary">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                            </button>
                                          ) : (
                                            <button type="button" onClick={() => setProdFilterState((st) => ({ ...st, filterExcludedSkus: [...st.filterExcludedSkus, p.product_sku] }))} className="text-muted-foreground transition-colors hover:text-destructive">
                                              <X className="size-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {searchTerm && displayedResults.length === 0 && (
                                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">Sin resultados para "{filterResultsSearch}"</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {submitted && <FieldError error={formErrors.products} />}
                </div>
              )}

              {/* STEP 3: Alcance */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="font-medium">Alcance <span className="text-destructive">*</span></Label>
                    <Select value={scope} onValueChange={setScope}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCOPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {scope === 'all' && (
                    <div className="rounded-lg border border-dashed">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <Users className="size-4 shrink-0 text-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground">La promocion aplicara a toda tu base de clientes activos sin excepcion</span>
                      </div>
                    </div>
                  )}
                  {scope === 'customers' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
                        {loadingCustomerOptions ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" />}
                        <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Buscar clientes por nombre, NIT o email" />
                        {customerSearch && <button type="button" onClick={() => { setCustomerSearch(''); setCustomerOptions([]); }}><X className="size-4 text-muted-foreground hover:text-foreground" /></button>}
                      </div>
                      {customerOptions.length > 0 && (
                        <div className="max-h-56 overflow-y-auto rounded-md border divide-y" onScroll={(e) => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) loadMoreCustomers(); }}>
                          {customerOptions.map((customer) => {
                            const nit = String(customer.customer_government_id || '');
                            if (!nit) return null;
                            const name = String(customer.customer_full_name || `Cliente ${nit}`);
                            return (
                              <button key={nit} type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => addCustomerId(nit, name)}>
                                <span className="min-w-0 truncate">{name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{nit}</span>
                              </button>
                            );
                          })}
                          {loadingMoreCustomers && <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Cargando más…</div>}
                        </div>
                      )}
                      <div className={cn("rounded-lg border", selectedCustomerIds.length === 0 && "border-dashed")}>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Users className={cn("size-4 shrink-0", selectedCustomerIds.length === 0 ? "text-muted-foreground/50" : "text-primary")} />
                            <span className={cn("text-sm font-medium", selectedCustomerIds.length === 0 && "text-muted-foreground")}>
                              {selectedCustomerIds.length === 0 ? 'Sin clientes seleccionados' : `${selectedCustomerIds.length} cliente(s) seleccionado(s)`}
                            </span>
                          </div>
                          {selectedCustomerIds.length > 0 && (
                            <button type="button" onClick={() => setShowSelectedCustomers((v) => !v)} className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm hover:bg-muted/50 hover:text-foreground">
                              {showSelectedCustomers ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                              {showSelectedCustomers ? 'Ocultar' : 'Ver'}
                            </button>
                          )}
                        </div>
                        {showSelectedCustomers && selectedCustomerIds.length > 0 && (
                          <div className="divide-y border-t">
                            {selectedCustomerIds.map((id) => (
                              <div key={id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                <span className="min-w-0 truncate">{customerNameMap[id] ?? `Cliente ${id}`}</span>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">{id}</span>
                                  <button type="button" onClick={() => setSelectedCustomerIds((prev) => prev.filter((item) => item !== id))}><X className="size-3.5 text-muted-foreground hover:text-foreground" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {submitted && <FieldError error={formErrors.scope} />}
                    </div>
                  )}
                  {scope === 'customer_segment' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-medium">Segmento <span className="text-destructive">*</span></Label>
                        <Select value={segment} onValueChange={setSegment}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SEGMENT_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {segment === 'custom' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <SlidersHorizontal className="size-4 text-primary" />
                            <span className="flex-1">Filtros de clientes</span>
                            {hasCustomerFilters && (
                              <button type="button" onClick={() => { setCustomerFilterBusinessType(''); setCustomerFilterCity(''); setCustomerFilterState(''); setCustomerFilterRepresentative('all'); setCustomerFilterLocation('all'); setCustomerFilterMinPurchases(''); setCustomerFilterMaxPurchases(''); setCustomerFilterMinDays(''); setCustomerFilterMaxDays(''); setCustomerFilterClv(''); setCustomerFilterRfm(''); setCustFilterState((s) => ({ ...s, customerFilterCount: null, customerFilterResults: [], showFilteredCustomers: false, customerExcludedIds: [] })); }} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                                <X className="size-3" />Limpiar
                              </button>
                            )}
                          </div>
                          <div className="rounded-lg border bg-muted/30 p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Tipo de negocio</Label>
                                <SearchableSelect value={customerFilterBusinessType || 'all'} onValueChange={(value) => setCustomerFilterBusinessType(value === 'all' ? '' : value)} options={businessTypeSelectOptions} allLabel="Todos los tipos" searchPlaceholder="Buscar tipo…" emptyLabel="No hay tipos" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Representante</Label>
                                <SearchableSelect value={customerFilterRepresentative} onValueChange={setCustomerFilterRepresentative} options={representativeSelectOptions} allLabel="Todos" searchPlaceholder="Buscar representante…" emptyLabel="No hay representantes" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Segmento CLV</Label>
                                <SearchableSelect value={customerFilterClv || 'all'} onValueChange={(value) => setCustomerFilterClv(value === 'all' ? '' : value)} options={customerClvSelectOptions} allLabel="Todos" searchPlaceholder="Buscar CLV…" emptyLabel="No hay segmentos CLV" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Segmento RFM</Label>
                                <SearchableSelect value={customerFilterRfm || 'all'} onValueChange={(value) => setCustomerFilterRfm(value === 'all' ? '' : value)} options={customerRfmSelectOptions} allLabel="Todos" searchPlaceholder="Buscar RFM…" emptyLabel="No hay segmentos RFM" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Ciudad</Label>
                                <Input value={customerFilterCity} onChange={(e) => setCustomerFilterCity(e.target.value)} placeholder="Bogota" className="bg-background" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Departamento</Label>
                                <Input value={customerFilterState} onChange={(e) => setCustomerFilterState(e.target.value)} placeholder="Cundinamarca" className="bg-background" />
                              </div>
                              <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-xs font-medium text-muted-foreground">Ubicacion</Label>
                                <Select value={customerFilterLocation} onValueChange={setCustomerFilterLocation}>
                                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="with">Con ubicacion</SelectItem>
                                    <SelectItem value="without">Sin ubicacion</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Compras realizadas</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  <Input type="number" min={0} value={customerFilterMinPurchases} onChange={(e) => setCustomerFilterMinPurchases(e.target.value)} placeholder="Min." className="bg-background" />
                                  <Input type="number" min={0} value={customerFilterMaxPurchases} onChange={(e) => setCustomerFilterMaxPurchases(e.target.value)} placeholder="Max." className="bg-background" />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Dias sin compra</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  <Input type="number" min={0} value={customerFilterMinDays} onChange={(e) => setCustomerFilterMinDays(e.target.value)} placeholder="Min." className="bg-background" />
                                  <Input type="number" min={0} value={customerFilterMaxDays} onChange={(e) => setCustomerFilterMaxDays(e.target.value)} placeholder="Max." className="bg-background" />
                                </div>
                              </div>
                            </div>
                          </div>
                          {(() => {
                            const effectiveCount = (customerFilterCount ?? 0) - customerExcludedIds.length;
                            const isZero = hasCustomerFilters && !customerFilterFetching && customerFilterCount !== null && effectiveCount === 0;
                            const searchTerm = customerResultsSearch.trim().toLowerCase();
                            const includedC = customerFilterResults.filter((c) => !customerExcludedIds.includes(String(c['customer_government_id'] ?? '')));
                            const excludedC = customerFilterResults.filter((c) => customerExcludedIds.includes(String(c['customer_government_id'] ?? '')));
                            const allSortedC = [...includedC, ...excludedC];
                            const displayedResults = searchTerm
                              ? allSortedC.filter((c) => {
                                  const name = String(c.customer_full_name || c.customer_name || '').toLowerCase();
                                  const govId = String(c.customer_government_id || '').toLowerCase();
                                  return name.includes(searchTerm) || govId.includes(searchTerm);
                                })
                              : allSortedC;
                            return (
                              <div className={cn("rounded-lg border", !hasCustomerFilters && "border-dashed")}>
                                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    {customerFilterFetching ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <SlidersHorizontal className={cn("size-4 shrink-0", !hasCustomerFilters ? "text-muted-foreground/50" : isZero ? "text-destructive" : "text-primary")} />}
                                    <span className={cn("text-sm font-medium", !hasCustomerFilters || customerFilterFetching || customerFilterCount === null ? "text-muted-foreground" : isZero ? "text-destructive" : "text-foreground")}>
                                      {customerFilterFetching ? 'Buscando clientes...' : !hasCustomerFilters ? 'Sin filtros seleccionados' : customerFilterCount === null ? 'Aplica filtros para ver clientes' : isZero ? 'Sin clientes para estos filtros' : `${effectiveCount} incluido(s)${customerExcludedIds.length > 0 ? ` · ${customerExcludedIds.length} excluido(s)` : ''}`}
                                    </span>
                                  </div>
                                  {!customerFilterFetching && hasCustomerFilters && customerFilterCount !== null && customerFilterResults.length > 0 && (
                                    <button type="button" onClick={() => { setCustFilterState((s) => ({ ...s, showFilteredCustomers: !s.showFilteredCustomers })); setCustomerResultsSearch(''); }} className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm hover:bg-muted/50 hover:text-foreground">
                                      {showFilteredCustomers ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                      {showFilteredCustomers ? 'Ocultar' : 'Ver'}
                                    </button>
                                  )}
                                </div>
                                {showFilteredCustomers && customerFilterResults.length > 0 && (
                                  <div className="border-t">
                                    {customerFilterResults.length > 10 && (
                                      <div className="flex items-center gap-2 border-b px-3 py-2.5">
                                        <Search className="size-4 shrink-0 text-muted-foreground" />
                                        <input
                                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                          placeholder="Buscar en resultados..."
                                          value={customerResultsSearch}
                                          onChange={(e) => setCustomerResultsSearch(e.target.value)}
                                        />
                                        {customerResultsSearch && <button type="button" onClick={() => setCustomerResultsSearch('')}><X className="size-4 text-muted-foreground hover:text-foreground" /></button>}
                                      </div>
                                    )}
                                    <div className="max-h-72 overflow-y-auto divide-y">
                                      {displayedResults.map((c) => {
                                        const nit = String(c['customer_government_id'] ?? '');
                                        const isExcluded = customerExcludedIds.includes(nit);
                                        return (
                                          <div key={String(c['customer_government_id'] || c.id)} className={cn("flex items-center justify-between gap-3 px-3 py-2.5 text-sm", isExcluded && "opacity-50")}>
                                            <span className={cn("min-w-0 truncate", isExcluded && "line-through")}>{String(c.customer_full_name || c.customer_name || `Cliente ${nit || c.id}`)}</span>
                                            <div className="flex shrink-0 items-center gap-2">
                                              <span className="font-mono text-xs text-muted-foreground">{nit}</span>
                                              {isExcluded ? (
                                                <button type="button" title="Volver a incluir" onClick={() => setCustFilterState((s) => ({ ...s, customerExcludedIds: s.customerExcludedIds.filter((id) => id !== nit) }))} className="text-muted-foreground hover:text-primary">
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                                                </button>
                                              ) : (
                                                <button type="button" title="Excluir" onClick={() => { if (nit) setCustFilterState((s) => ({ ...s, customerExcludedIds: [...s.customerExcludedIds, nit] })); }}><X className="size-3.5 text-muted-foreground hover:text-destructive" /></button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {searchTerm && displayedResults.length === 0 && (
                                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">Sin resultados para "{customerResultsSearch}"</p>
                                      )}
                                      {customerFilterCount != null && customerFilterCount > customerFilterResults.length && !searchTerm && (
                                        <div className="px-3 py-2.5 text-xs text-muted-foreground">...y {customerFilterCount - customerFilterResults.length} más sin cargar</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      {segment !== 'custom' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-4 py-3">
                            <SlidersHorizontal className="size-4 shrink-0 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Filtro predefinido activo</p>
                              <p className="text-xs text-muted-foreground">{SEGMENT_OPTIONS.find((o) => o.value === segment)?.label}</p>
                            </div>
                            <button type="button" onClick={() => { setSegment('custom'); setCustFilterState((s) => ({ ...s, customerFilterCount: null, customerFilterResults: [], showFilteredCustomers: false })); }} className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground shadow-sm hover:bg-muted/50 hover:text-foreground">
                              <X className="size-3" />Limpiar
                            </button>
                          </div>
                          <div className={cn("rounded-lg border", customerFilterCount === null && "border-dashed")}>
                            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                {customerFilterFetching ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <SlidersHorizontal className={cn("size-4 shrink-0", customerFilterCount === null ? "text-muted-foreground/50" : customerFilterCount === 0 ? "text-destructive" : "text-primary")} />}
                                <span className={cn("text-sm font-medium", customerFilterFetching || customerFilterCount === null ? "text-muted-foreground" : customerFilterCount === 0 ? "text-destructive" : "text-foreground")}>
                                  {customerFilterFetching ? 'Calculando clientes...' : customerFilterCount === null ? 'Calculando...' : customerFilterCount === 0 ? 'Sin clientes para este segmento' : `${customerFilterCount} cliente(s) en este segmento`}
                                </span>
                              </div>
                              {!customerFilterFetching && customerFilterCount != null && customerFilterCount > 0 && (
                                <button type="button" onClick={() => setCustFilterState((s) => ({ ...s, showFilteredCustomers: !s.showFilteredCustomers }))} className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm hover:bg-muted/50 hover:text-foreground">
                                  {showFilteredCustomers ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                  {showFilteredCustomers ? 'Ocultar' : 'Ver'}
                                </button>
                              )}
                            </div>
                            {showFilteredCustomers && customerFilterResults.length > 0 && (
                              <div className="max-h-48 overflow-y-auto divide-y border-t">
                                {customerFilterResults.map((c) => (
                                  <div key={String(c.id)} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                    <span className="min-w-0 truncate">{String(c.customer_full_name || c.customer_name || `Cliente ${c.id}`)}</span>
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{String(c.customer_government_id || '')}</span>
                                  </div>
                                ))}
                                {customerFilterCount != null && customerFilterCount > customerFilterResults.length && (
                                  <div className="px-3 py-2.5 text-xs text-muted-foreground">...y {customerFilterCount - customerFilterResults.length} más</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {submitted && <FieldError error={formErrors.scope} />}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Regla Comercial */}
              {currentStep === 4 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="font-medium">Tipo de promocion <span className="text-destructive">*</span></Label>
                    <Select value={mechanicState.promotionType} onValueChange={setPromotionType}>
                      <SelectTrigger><SelectValue placeholder="Selecciona el tipo de promocion" /></SelectTrigger>
                      <SelectContent>
                        {PROMOTION_TYPE_OPTIONS.map((option) => {
                          const enabled = option.value === 'descuento_linea' || option.value === 'bonificacion_cantidad';
                          return (
                            <SelectItem key={option.value} value={option.value} disabled={!enabled}>{option.label}</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {mechanicState.promotionType && (
                      <p className="text-xs text-muted-foreground">{PROMOTION_TYPE_OPTIONS.find((o) => o.value === mechanicState.promotionType)?.helpText}</p>
                    )}
                  </div>

                  {!mechanicState.promotionType && (
                    <div className="rounded-lg border border-dashed">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <Zap className="size-4 shrink-0 text-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground">Selecciona el tipo de promocion para configurar la regla comercial</span>
                      </div>
                    </div>
                  )}

                  {mechanicState.promotionType && (
                    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                      {mechanicState.promotionType === 'descuento_linea' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Tipo de descuento</Label>
                            <Select value={mechanicState.mechanic.discount_type || 'percentage'} onValueChange={(v) => updateMechanic({ discount_type: v as 'percentage' | 'fixed' })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{DISCOUNT_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value} disabled={item.value === 'fixed'}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Porcentaje (%)</Label>
                            <Input type="number" min={1} max={100} placeholder="Ej: 15" value={mechanicState.mechanic.discount_value || ''} onChange={(e) => { let v = e.target.value ? Number(e.target.value) : null; if (v !== null && mechanicState.mechanic.discount_type === 'percentage') v = Math.min(100, Math.max(1, v)); else if (v !== null) v = Math.max(1, v); updateMechanic({ discount_value: v }); }} />
                          </div>
                        </div>
                      )}
                      {mechanicState.promotionType === 'bonificacion_cantidad' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Cantidad a comprar (X)</Label>
                            <Input type="number" min={1} step={1} placeholder="Ej: 10" value={mechanicState.mechanic.base_quantity || ''} onChange={(e) => updateMechanic({ base_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Unidades bonificadas (N)</Label>
                            <Input type="number" min={1} step={1} placeholder="Ej: 2" value={mechanicState.mechanic.bonus_quantity || ''} onChange={(e) => updateMechanic({ bonus_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })} />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-xs font-medium text-muted-foreground">Tipo de producto bonificado</Label>
                            <Select value={mechanicState.mechanic.bonus_product_type || 'same_product'} onValueChange={(v) => updateMechanic({ bonus_product_type: v as 'same_product' | 'different_product', bonus_product_id: null, bonus_product_name: null })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{BONUS_PRODUCT_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value} disabled={item.disabled}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {mechanicState.mechanic.bonus_product_type === 'different_product' && (
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-xs font-medium text-muted-foreground">Producto bonificado</Label>
                              <SearchableSelect value={mechanicState.mechanic.bonus_product_id || 'all'} onValueChange={(v) => updateMechanic({ bonus_product_id: v === 'all' ? null : v, bonus_product_name: v === 'all' ? null : productLabelBySku(v) })} options={productSelectOptions} allLabel="Selecciona producto" searchPlaceholder="Buscar producto…" emptyLabel="No hay productos" />
                            </div>
                          )}
                        </div>
                      )}
                      {mechanicState.promotionType === 'precio_especial' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Precio especial ($)</Label>
                            <Input type="number" min={1} placeholder="Ej: 45000" value={mechanicState.mechanic.special_price || ''} onChange={(e) => updateMechanic({ special_price: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">¿Requiere cantidad minima?</Label>
                            <Select value={mechanicState.conditionType || 'none'} onValueChange={(v) => setMechanicState((prev) => ({ ...prev, conditionType: v as PromotionMechanicFormState['conditionType'] }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No</SelectItem>
                                <SelectItem value="minimum_quantity">Si</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {mechanicState.conditionType === 'minimum_quantity' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Cantidad minima (uds)</Label>
                              <Input type="number" min={1} step={1} placeholder="Ej: 5" value={mechanicState.mechanic.minimum_quantity || ''} onChange={(e) => updateMechanic({ minimum_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })} />
                            </div>
                          )}
                        </div>
                      )}
                      {mechanicState.promotionType === 'descuento_volumen' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Condicion de compra</Label>
                            <Select value={mechanicState.conditionType || 'minimum_amount'} onValueChange={(v) => setMechanicState((prev) => ({ ...prev, conditionType: v as PromotionMechanicFormState['conditionType'] }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{MINIMUM_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {mechanicState.conditionType === 'minimum_amount' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Monto minimo ($)</Label>
                              <Input type="number" min={1} placeholder="Ej: 500000" value={mechanicState.mechanic.minimum_amount || ''} onChange={(e) => updateMechanic({ minimum_amount: e.target.value ? Math.max(1, Number(e.target.value)) : null, minimum_quantity: null })} />
                            </div>
                          )}
                          {mechanicState.conditionType === 'minimum_quantity' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Cantidad minima (uds)</Label>
                              <Input type="number" min={1} step={1} placeholder="Ej: 20" value={mechanicState.mechanic.minimum_quantity || ''} onChange={(e) => updateMechanic({ minimum_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null, minimum_amount: null })} />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Tipo de descuento</Label>
                            <Select value={mechanicState.mechanic.discount_type || 'percentage'} onValueChange={(v) => updateMechanic({ discount_type: v as 'percentage' | 'fixed', discount_value: null })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{DISCOUNT_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">{mechanicState.mechanic.discount_type === 'fixed' ? 'Valor ($)' : 'Porcentaje (%)'}</Label>
                            <Input type="number" min={1} max={mechanicState.mechanic.discount_type === 'percentage' ? 100 : undefined} placeholder={mechanicState.mechanic.discount_type === 'fixed' ? 'Ej: 5000' : 'Ej: 15'} value={mechanicState.mechanic.discount_value || ''} onChange={(e) => { let v = e.target.value ? Number(e.target.value) : null; if (v !== null && mechanicState.mechanic.discount_type === 'percentage') v = Math.min(100, Math.max(1, v)); else if (v !== null) v = Math.max(1, v); updateMechanic({ discount_value: v }); }} />
                          </div>
                        </div>
                      )}
                      {mechanicState.promotionType === 'bonificacion_volumen' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Condicion de compra</Label>
                            <Select value={mechanicState.conditionType || 'minimum_amount'} onValueChange={(v) => setMechanicState((prev) => ({ ...prev, conditionType: v as PromotionMechanicFormState['conditionType'] }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{MINIMUM_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {mechanicState.conditionType === 'minimum_amount' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Monto minimo ($)</Label>
                              <Input type="number" min={1} placeholder="Ej: 500000" value={mechanicState.mechanic.minimum_amount || ''} onChange={(e) => updateMechanic({ minimum_amount: e.target.value ? Math.max(1, Number(e.target.value)) : null, minimum_quantity: null })} />
                            </div>
                          )}
                          {mechanicState.conditionType === 'minimum_quantity' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">Cantidad minima (uds)</Label>
                              <Input type="number" min={1} step={1} placeholder="Ej: 20" value={mechanicState.mechanic.minimum_quantity || ''} onChange={(e) => updateMechanic({ minimum_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null, minimum_amount: null })} />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Producto bonificado</Label>
                            <SearchableSelect value={mechanicState.mechanic.bonus_product_id || 'all'} onValueChange={(v) => updateMechanic({ bonus_product_id: v === 'all' ? null : v, bonus_product_name: v === 'all' ? null : productLabelBySku(v) })} options={productSelectOptions} allLabel="Selecciona producto" searchPlaceholder="Buscar producto…" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Cantidad bonificada (uds)</Label>
                            <Input type="number" min={1} step={1} placeholder="Ej: 3" value={mechanicState.mechanic.bonus_quantity || ''} onChange={(e) => updateMechanic({ bonus_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })} />
                          </div>
                        </div>
                      )}
                      {mechanicState.promotionType === 'combo' && (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">Productos del combo (min. 2)</Label>
                              <Button type="button" variant="outline" size="sm" onClick={addRequiredProduct}>Agregar</Button>
                            </div>
                            <div className="space-y-2">
                              {(mechanicState.mechanic.required_products || []).map((item, index) => (
                                <div key={requiredProductKey(item)} className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                                  <SearchableSelect value={item.product_id || 'all'} onValueChange={(v) => updateRequiredProduct(index, { product_id: v === 'all' ? '' : v, product_name: v === 'all' ? null : productLabelBySku(v) })} options={productSelectOptions} allLabel="Selecciona producto" searchPlaceholder="Buscar producto…" />
                                  <Input type="number" min={1} step={1} placeholder="Cant. min." value={item.minimum_quantity || ''} onChange={(e) => updateRequiredProduct(index, { minimum_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })} />
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRequiredProduct(index)}><X className="size-4" /></Button>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Regla del combo</Label><Select value={mechanicState.mechanic.bundle_rule || 'all_required'} onValueChange={(v) => updateMechanic({ bundle_rule: v as 'all_required' | 'any_required' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BUNDLE_RULE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Beneficio</Label><Select value={mechanicState.benefitType || 'percentage_discount'} onValueChange={(v) => setMechanicState((prev) => ({ ...prev, benefitType: v as PromotionMechanicFormState['benefitType'], mechanic: { ...prev.mechanic, discount_value: null } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMBO_BENEFIT_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                            {mechanicState.benefitType === 'percentage_discount' && (
                              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Porcentaje (%)</Label><Input type="number" min={1} max={100} placeholder="Ej: 20" value={mechanicState.mechanic.discount_value || ''} onChange={(e) => updateMechanic({ discount_type: 'percentage', discount_value: e.target.value ? Math.min(100, Math.max(1, Number(e.target.value))) : null })} /></div>
                            )}
                            {mechanicState.benefitType === 'fixed_discount' && (
                              <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Valor ($)</Label><Input type="number" min={1} placeholder="Ej: 5000" value={mechanicState.mechanic.discount_value || ''} onChange={(e) => updateMechanic({ discount_type: 'fixed', discount_value: e.target.value ? Math.max(1, Number(e.target.value)) : null })} /></div>
                            )}
                            {mechanicState.benefitType === 'bonus_product' && (
                              <>
                                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Producto bonificado</Label><SearchableSelect value={mechanicState.mechanic.bonus_product_id || 'all'} onValueChange={(v) => updateMechanic({ bonus_product_id: v === 'all' ? null : v, bonus_product_name: v === 'all' ? null : productLabelBySku(v) })} options={productSelectOptions} allLabel="Selecciona producto" searchPlaceholder="Buscar producto…" /></div>
                                <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Cantidad bonificada</Label><Input type="number" min={1} step={1} placeholder="Ej: 1" value={mechanicState.mechanic.bonus_quantity || ''} onChange={(e) => updateMechanic({ bonus_quantity: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })} /></div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {submitted && <FieldError error={formErrors.mechanic} />}
                      <div className="rounded-md border border-dashed bg-background p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resumen dinamico</p>
                        <p className="mt-1 text-sm text-foreground">{mechanicSummary}</p>
                      </div>
                    </div>
                  )}
                  {!mechanicState.promotionType && submitted && <FieldError error={formErrors.mechanic} />}
                </div>
              )}

              {/* STEP 5: Resumen */}
              {currentStep === 5 && (
                <div className="space-y-3">
                  {submitted && [1, 2, 3, 4].some((s) => stepHasErrors(s)) && (
                    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/15">
                        <AlertTriangle className="size-3.5 text-destructive" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-destructive">Revisa estos pasos antes de guardar</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {[1, 2, 3, 4].filter((s) => stepHasErrors(s)).map((s) => (
                            <button key={s} type="button" onClick={() => setCurrentStep(s)} className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20">
                              {STEPS[s - 1].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hero card */}
                  <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="mb-2 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                          {isEditing ? 'Editando promocion' : 'Nuevo borrador'}
                        </span>
                        <h3 className="mt-1.5 truncate text-sm font-semibold leading-tight">{title || '—'}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{laboratories.find((l) => l.id === labId)?.name || labId}</p>
                        {origin && <p className="mt-0.5 text-xs text-muted-foreground">{origin}</p>}
                      </div>
                    </div>
                    {startDate && endDate && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/15 bg-background/60 px-3 py-2 text-xs">
                        <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                        <span className="font-medium text-foreground">{startDate}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">{endDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Section cards */}
                  <div className="grid gap-2.5">
                    {/* Productos */}
                    <div className="rounded-xl border bg-card overflow-hidden">
                      <div className="flex items-center gap-2.5 border-b bg-muted/30 px-4 py-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                          <Package className="size-3.5 text-primary" />
                        </div>
                        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Productos</span>
                        <button type="button" onClick={() => setCurrentStep(2)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">Editar</button>
                      </div>
                      <div className="divide-y px-4">
                        <SummaryRow2 label="Modo" value={productApplicationMode === 'specific' ? 'Productos especificos' : 'Por filtros'} />
                        {productApplicationMode === 'specific' ? (
                          <SummaryRow2 label="Seleccionados" value={
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                              {selectedProductSkus.length} producto{selectedProductSkus.length !== 1 ? 's' : ''}
                            </span>
                          } />
                        ) : (
                          <>
                            {[productFilterBrand, productFilterSector, productFilterCategory, productFilterSpecies].filter(Boolean).length > 0 && (
                              <SummaryRow2 label="Filtros" value={
                                <div className="flex flex-wrap gap-1">
                                  {[productFilterBrand, productFilterSector, productFilterCategory, productFilterSpecies].filter(Boolean).map((f) => (
                                    <span key={f} className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">{f}</span>
                                  ))}
                                </div>
                              } />
                            )}
                            {productFilterCount != null && (
                              <SummaryRow2 label="Coincidencias" value={
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  {(productFilterCount - filterExcludedSkus.length).toLocaleString()} encontrado{productFilterCount !== 1 ? 's' : ''}
                                </span>
                              } />
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Alcance */}
                    <div className="rounded-xl border bg-card overflow-hidden">
                      <div className="flex items-center gap-2.5 border-b bg-muted/30 px-4 py-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                          <Users className="size-3.5 text-primary" />
                        </div>
                        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alcance</span>
                        <button type="button" onClick={() => setCurrentStep(3)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">Editar</button>
                      </div>
                      <div className="divide-y px-4">
                        <SummaryRow2 label="Aplica a" value={SCOPE_OPTIONS.find((o) => o.value === scope)?.label || scope} />
                        {scope === 'customers' && (
                          <SummaryRow2 label="Clientes" value={
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                              {selectedCustomerIds.length} seleccionado{selectedCustomerIds.length !== 1 ? 's' : ''}
                            </span>
                          } />
                        )}
                        {scope === 'customer_segment' && (
                          <SummaryRow2 label="Segmento" value={SEGMENT_OPTIONS.find((o) => o.value === segment)?.label || segment} />
                        )}
                        {scope === 'customer_segment' && customerFilterCount != null && (
                          <SummaryRow2 label="Clientes" value={
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {(customerFilterCount - customerExcludedIds.length).toLocaleString()} encontrado{customerFilterCount !== 1 ? 's' : ''}
                            </span>
                          } />
                        )}
                      </div>
                    </div>

                    {/* Regla Comercial */}
                    <div className="rounded-xl border bg-card overflow-hidden">
                      <div className="flex items-center gap-2.5 border-b bg-muted/30 px-4 py-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                          <Zap className="size-3.5 text-primary" />
                        </div>
                        <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regla Comercial</span>
                        <button type="button" onClick={() => setCurrentStep(4)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">Editar</button>
                      </div>
                      <div className="divide-y px-4">
                        <SummaryRow2 label="Tipo" value={
                          mechanicState.promotionType
                            ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{PROMOTION_TYPE_OPTIONS.find((o) => o.value === mechanicState.promotionType)?.label || mechanicState.promotionType}</span>
                            : 'Sin configurar'
                        } />
                        {mechanicSummary !== 'Selecciona el tipo de promocion para ver el resumen.' && (
                          <SummaryRow2 label="Condicion" value={mechanicSummary} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Control Financiero */}
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="flex items-center gap-2.5 border-b bg-muted/30 px-4 py-2.5">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <DollarSign className="size-3.5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Control Financiero</span>
                    </div>
                    <div className="grid gap-3 p-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="estimatedCost" className="text-xs font-medium">Costo Estimado ($) <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                        <Input id="estimatedCost" type="number" min={0} value={estimatedCost || ''} onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)} placeholder="1000000" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="maxRedemptions" className="text-xs font-medium">Max. Redenciones <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                        <Input id="maxRedemptions" type="number" min={0} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value ? parseInt(e.target.value, 10) : '')} placeholder="500" />
                      </div>
                    </div>
                    {estimatedCost > 0 && !budgetError && (
                      <div className="mx-4 mb-4 divide-y rounded-lg border bg-muted/20 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-xs text-muted-foreground">Costo estimado</span>
                          <span className="text-sm font-semibold text-primary">{formatCurrency(estimatedCost)}</span>
                        </div>
                        {spendableBalance !== null && (
                          <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs text-muted-foreground">Saldo disponible</span>
                            <span className="text-sm font-semibold">{formatCurrency(spendableBalance)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {budgetError && (
                      <div className="mx-4 mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        <p className="text-xs font-medium text-destructive">{budgetError}</p>
                      </div>
                    )}
                    {approvalWarning && !budgetError && (
                      <div className="mx-4 mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                        <p className="text-xs font-medium text-amber-800">{approvalWarning}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex shrink-0 items-center justify-between border-t bg-muted/10 px-6 py-4">
          <Button variant="outline" onClick={goPrev} disabled={isSubmitting}>
            {currentStep === 1
              ? 'Cancelar'
              : <span className="flex items-center gap-1.5"><ChevronLeft className="size-4" />Anterior</span>}
          </Button>
          <Button onClick={goNext} disabled={isSubmitting || (currentStep === 5 && !!budgetError)}>
            {currentStep === 5
              ? (isSubmitting
                ? <span className="flex items-center gap-1.5"><Loader2 className="size-4 animate-spin" />{isEditing ? 'Actualizando…' : 'Guardando…'}</span>
                : (isEditing ? 'Actualizar Promocion' : 'Guardar Promocion'))
              : <span className="flex items-center gap-1.5">Siguiente<ChevronRight className="size-4" /></span>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-destructive">{error}</p>;
}

function StepHeader({ step }: { step: number }) {
  const stepDef = STEPS.find((s) => s.id === step)!;
  const meta = STEP_META[step];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-tight">{stepDef.label}</h3>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>
    </div>
  );
}

function StepSummary({ title, step, onEdit, children }: { title: string; step: number; onEdit: () => void; children: React.ReactNode }) {
  const meta = STEP_META[step];
  const Icon = meta.icon;
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </div>
        <p className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <button type="button" onClick={onEdit} className="text-xs text-primary hover:underline">Editar</button>
      </div>
      <div className="space-y-1 pl-8">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}:</span>
      <span className="min-w-0 break-words font-medium">{value}</span>
    </div>
  );
}

function SummaryRow2({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium">{value}</span>
    </div>
  );
}
