import { useState, useEffect, useMemo } from 'react';
import {
  createPromotion,
  getPromotion,
  getPromotionBudget,
  listCustomers,
  listProducts,
  updatePromotion,
  CustomerRecord,
  ProductCatalogItem,
} from '@/lib/api';
import { usePromoter } from '@/contexts/PromoterContext';
import { Laboratory, Promotion } from '@/types/database';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, Zap, DollarSign, AlertTriangle, Target, Search, X } from 'lucide-react';
import { toast } from 'sonner';

interface PromotionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laboratories: Laboratory[];
  onSuccess: () => void;
  editingPromo?: Promotion | null;
}

const SEGMENT_OPTIONS = [
  { value: 'ganaderia', label: 'Ganaderia' },
  { value: 'mascotas', label: 'Mascotas' },
  { value: 'todo', label: 'Todo el pais' },
];

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Toda mi base' },
  { value: 'customers', label: 'Clientes especificos' },
  { value: 'customer_segment', label: 'Segmento de clientes' },
  { value: 'product_filters', label: 'Linea / categoria / marca / especie' },
];

const CONDITION_TYPES = [
  { value: 'none', label: 'Sin condicion' },
  { value: 'min_quantity', label: 'Cantidad minima' },
  { value: 'min_amount', label: 'Monto Minimo de Compra' },
  { value: 'buy_x_get_y', label: 'Pague X Lleve Y' },
  { value: 'product_mix', label: 'Mezcla de productos' },
];

const REWARD_TYPES = [
  { value: 'discount_percent', label: 'Descuento Porcentual' },
  { value: 'discount_amount', label: 'Descuento Fijo' },
  { value: 'free_product', label: 'Producto Gratis (Bonificacion)' },
  { value: 'price_override', label: 'Precio Especial' },
  { value: 'cashback_credit', label: 'Credito / Nota Posterior' },
];

const ACCOUNTING_TREATMENTS = [
  { value: 'descuento_pie', label: 'Descuento Pie de Factura' },
  { value: 'bonificacion_precio_cero', label: 'Bonificacion a Precio Cero' },
  { value: 'nota_credito_posterior', label: 'Nota Credito Posterior' },
];

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [segment, setSegment] = useState('todo');
  const [scope, setScope] = useState('all');
  const [selectedProductSkus, setSelectedProductSkus] = useState<string[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [productFilterBrand, setProductFilterBrand] = useState('');
  const [productFilterCategory, setProductFilterCategory] = useState('');
  const [productFilterLine, setProductFilterLine] = useState('');
  const [productFilterSpecies, setProductFilterSpecies] = useState('');
  const [customerFilterBusinessType, setCustomerFilterBusinessType] = useState('');
  const [customerFilterCity, setCustomerFilterCity] = useState('');
  const [customerFilterState, setCustomerFilterState] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productOptions, setProductOptions] = useState<ProductCatalogItem[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerRecord[]>([]);
  const [loadingProductOptions, setLoadingProductOptions] = useState(false);
  const [loadingCustomerOptions, setLoadingCustomerOptions] = useState(false);
  const [conditionType, setConditionType] = useState('sku_list');
  const [conditionValue, setConditionValue] = useState('');
  const [conditionQty, setConditionQty] = useState<number>(0);
  const [rewardType, setRewardType] = useState('free_product');
  const [rewardValue, setRewardValue] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [accountingTreatment, setAccountingTreatment] = useState('descuento_pie');
  const [maxRedemptions, setMaxRedemptions] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMechanic, setIsLoadingMechanic] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [spendableBalance, setSpendableBalance] = useState<number | null>(null);

  useEffect(() => {
    if (open && editingPromo) {
      const fetchPromotion = async () => {
        setIsLoadingMechanic(true);
        try {
          const details = await getPromotion(editingPromo.id);
          setLabId(details.lab_id);
          setTitle(details.title);
          setDescription(details.description || '');
          setStartDate(details.start_date);
          setEndDate(details.end_date);
          const targetSegment = details.target_segment as {
            type?: string;
            scope?: string;
            product_skus?: string[];
            target_config?: Record<string, string>;
            customer_ids?: string[];
            product_filters?: Record<string, string>;
            customer_filters?: Record<string, string>;
          } | null;
          const targetScope = details.target_scope || targetSegment?.scope || (targetSegment?.type && targetSegment.type !== 'todo' ? 'customer_segment' : 'all');
          const targetConfig = (details.target_config || targetSegment?.target_config || {}) as Record<string, string | string[] | undefined>;
          setSegment(String(targetConfig.segment || targetSegment?.type || 'todo'));
          setScope(targetScope);
          setSelectedProductSkus(Array.isArray(details.product_skus) ? details.product_skus : Array.isArray(targetSegment?.product_skus) ? targetSegment.product_skus : []);
          setSelectedCustomerIds(Array.isArray(targetConfig.customer_ids) ? targetConfig.customer_ids.map(String) : Array.isArray(targetSegment?.customer_ids) ? targetSegment.customer_ids : []);
          setProductFilterBrand(String(targetConfig.brand_name || targetSegment?.product_filters?.brand_name || ''));
          setProductFilterCategory(String(targetConfig.category || targetSegment?.product_filters?.category || ''));
          setProductFilterLine(String(targetConfig.line_name || targetSegment?.product_filters?.line_name || ''));
          setProductFilterSpecies(String(targetConfig.target_species || targetSegment?.product_filters?.target_species || ''));
          setCustomerFilterBusinessType(String(targetConfig.business_type || targetSegment?.customer_filters?.business_type || ''));
          setCustomerFilterCity(String(targetConfig.city || targetSegment?.customer_filters?.city || ''));
          setCustomerFilterState(String(targetConfig.state || targetSegment?.customer_filters?.state || ''));
          setEstimatedCost(details.estimated_cost || 0);
          setMaxRedemptions(details.max_redemptions || '');

          const mechanic = details.mechanic;
          if (mechanic) {
            setConditionType(mechanic.condition_type || 'none');
            setAccountingTreatment(mechanic.accounting_treatment || 'descuento_pie');
            setRewardType(mechanic.reward_type || 'free_product');
            const condConfig = mechanic.condition_config as { skus?: string[]; quantity?: number; min_amount?: number; category?: string; min_qty?: number; buy_qty?: number } | null;
            if (condConfig) {
              setConditionValue(Array.isArray(condConfig.skus) ? condConfig.skus.join(', ') : condConfig.category || '');
              setConditionQty(Number(condConfig.quantity ?? condConfig.min_qty ?? condConfig.min_amount ?? condConfig.buy_qty ?? 0));
            }
            const rewConfig = mechanic.reward_config as { value?: number; free_qty?: number; discount_percent?: number; discount_amount?: number; special_price?: number; credit_amount?: number } | null;
            if (rewConfig) {
              setRewardValue(Number(rewConfig.value ?? rewConfig.free_qty ?? rewConfig.discount_percent ?? rewConfig.discount_amount ?? rewConfig.special_price ?? rewConfig.credit_amount ?? 0));
            }
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

  useEffect(() => {
    if (!open || productSearch.trim().length < 2) {
      setProductOptions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoadingProductOptions(true);
      try {
        const data = await listProducts({ search: productSearch.trim(), limit: 10 });
        setProductOptions(data);
      } catch {
        setProductOptions([]);
      } finally {
        setLoadingProductOptions(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, productSearch]);

  useEffect(() => {
    if (!open || scope !== 'customers' || customerSearch.trim().length < 2) {
      setCustomerOptions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoadingCustomerOptions(true);
      try {
        const data = await listCustomers({ search: customerSearch.trim(), limit: 10 });
        setCustomerOptions(data);
      } catch {
        setCustomerOptions([]);
      } finally {
        setLoadingCustomerOptions(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerSearch, open, scope]);

  const resetForm = () => {
    setLabId('');
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setSegment('todo');
    setScope('all');
    setSelectedProductSkus([]);
    setSelectedCustomerIds([]);
    setProductFilterBrand('');
    setProductFilterCategory('');
    setProductFilterLine('');
    setProductFilterSpecies('');
    setCustomerFilterBusinessType('');
    setCustomerFilterCity('');
    setCustomerFilterState('');
    setProductSearch('');
    setCustomerSearch('');
    setProductOptions([]);
    setCustomerOptions([]);
    setConditionType('none');
    setConditionValue('');
    setConditionQty(0);
    setRewardType('free_product');
    setRewardValue(0);
    setEstimatedCost(0);
    setAccountingTreatment('descuento_pie');
    setMaxRedemptions('');
    setBudgetError(null);
    setSpendableBalance(null);
    setApprovalWarning(null);
  };

  const buildConditionConfig = useMemo(() => {
    return () => {
      switch (conditionType) {
        case 'none':
          return {};
        case 'min_quantity':
          return { quantity: conditionQty };
        case 'min_amount':
          return { min_amount: conditionQty };
        case 'buy_x_get_y':
          return { buy_qty: conditionQty };
        case 'product_mix':
          return { skus: conditionValue.split(',').map((item) => item.trim()).filter(Boolean), quantity: conditionQty };
        default:
          return {};
      }
    };
  }, [conditionType, conditionValue, conditionQty]);

  const buildRewardConfig = useMemo(() => {
    return () => {
      switch (rewardType) {
        case 'free_product':
          return { free_qty: rewardValue, value: rewardValue };
        case 'discount_percent':
          return { discount_percent: rewardValue, value: rewardValue };
        case 'discount_amount':
          return { discount_amount: rewardValue, value: rewardValue };
        case 'price_override':
          return { special_price: rewardValue, value: rewardValue };
        case 'cashback_credit':
          return { credit_amount: rewardValue, value: rewardValue };
        default:
          return {};
      }
    };
  }, [rewardType, rewardValue]);

  const buildTargetSegment = useMemo(() => {
    return () => {
      const target: Record<string, unknown> = {};
      if (scope === 'customers') {
        target.customer_ids = selectedCustomerIds;
      }
      if (scope === 'product_filters') {
        target.product_filters = {
          brand_name: productFilterBrand || undefined,
          category: productFilterCategory || undefined,
          line_name: productFilterLine || undefined,
          target_species: productFilterSpecies || undefined,
        };
      }
      if (scope === 'customer_segment') {
        target.customer_filters = {
          business_type: customerFilterBusinessType || segment || undefined,
          city: customerFilterCity || undefined,
          state: customerFilterState || undefined,
        };
      }
      return target;
    };
  }, [
    customerFilterBusinessType,
    customerFilterCity,
    customerFilterState,
    productFilterBrand,
    productFilterCategory,
    productFilterLine,
    productFilterSpecies,
    scope,
    segment,
    selectedCustomerIds,
  ]);

  const addProductSku = (sku: string) => {
    if (!sku || selectedProductSkus.includes(sku)) return;
    setSelectedProductSkus((prev) => [...prev, sku]);
    setProductSearch('');
    setProductOptions([]);
  };

  const addCustomerId = (id: string) => {
    if (!id || selectedCustomerIds.includes(id)) return;
    setSelectedCustomerIds((prev) => [...prev, id]);
    setCustomerSearch('');
    setCustomerOptions([]);
  };

  const handleSubmit = async () => {
    if (!labId) {
      toast.error('Selecciona un laboratorio');
      return;
    }
    if (!title.trim()) {
      toast.error('Ingresa un titulo para la promocion');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Selecciona las fechas de vigencia');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('La fecha de inicio debe ser anterior a la de fin');
      return;
    }
    if (budgetError) {
      toast.error('No puedes guardar: el costo estimado supera el presupuesto gastable disponible.');
      return;
    }
    const hasProductFilters = Boolean(productFilterBrand || productFilterCategory || productFilterLine || productFilterSpecies);
    if (selectedProductSkus.length === 0 && !(scope === 'product_filters' && hasProductFilters)) {
      toast.error('Selecciona al menos un producto o define filtros de producto para resolverlos');
      return;
    }
    if (scope === 'customers' && selectedCustomerIds.length === 0) {
      toast.error('Selecciona al menos un cliente para este alcance');
      return;
    }
    if (scope === 'product_filters' && !hasProductFilters) {
      toast.error('Define al menos un filtro de linea, categoria, marca o especie');
      return;
    }
    if (scope === 'customer_segment' && !customerFilterBusinessType && !customerFilterCity && !customerFilterState && !segment) {
      toast.error('Define al menos un filtro para el segmento de clientes');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        lab_id: labId,
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        product_skus: selectedProductSkus,
        target_scope: scope as 'all' | 'customers' | 'customer_segment' | 'product_filters',
        target_config: buildTargetSegment(),
        estimated_cost: estimatedCost || null,
        max_redemptions: maxRedemptions || null,
        created_by_role: isPromoter ? ('laboratorio' as const) : ('distribuidor' as const),
        mechanic: {
          condition_type: conditionType,
          condition_config: buildConditionConfig(),
          reward_type: rewardType,
          reward_config: buildRewardConfig(),
          accounting_treatment: accountingTreatment,
        },
      };

      const result = isEditing && editingPromo
        ? await updatePromotion(editingPromo.id, payload)
        : await createPromotion(payload);

      if (result.requires_manager_approval) {
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

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Promocion' : 'Nueva Promocion'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Modifica los datos de la promocion' : 'Crea una nueva promocion comercial'}
          </SheetDescription>
        </SheetHeader>

        {isLoadingMechanic ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando datos...</span>
          </div>
        ) : (
          <div className="mt-6">
            <Accordion type="multiple" defaultValue={['general', 'products', 'scope', 'mechanics', 'financial']} className="space-y-4">
              <AccordionItem value="general" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Datos Generales</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="laboratory">Laboratorio</Label>
                    {isPromoter ? (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md border">
                        <span className="text-sm font-medium">
                          {laboratories.find((l) => l.id === labId)?.name || 'Laboratorio asignado'}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">Asignado</span>
                      </div>
                    ) : (
                      <Select value={labId} onValueChange={setLabId}>
                        <SelectTrigger id="laboratory">
                          <SelectValue placeholder="Selecciona un laboratorio" />
                        </SelectTrigger>
                        <SelectContent>
                          {laboratories.map((lab) => (
                            <SelectItem key={lab.id} value={lab.id}>
                              {lab.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Titulo de la Promocion</Label>
                    <Input id="title" placeholder="Ej: Pague 10 Lleve 12 - Ganaderia" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripcion (opcional)</Label>
                    <Textarea id="description" placeholder="Descripcion detallada de la promocion..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Fecha Inicio</Label>
                      <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">Fecha Fin</Label>
                      <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>

                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="products" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Productos de la Promocion</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Toda promocion debe quedar amarrada a uno o mas productos. Busca por SKU, nombre o marca.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar productos por SKU, nombre o marca" />
                  </div>
                  {loadingProductOptions && <p className="text-xs text-muted-foreground">Buscando productos...</p>}
                  {productOptions.length > 0 && (
                    <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                      {productOptions.map((product) => (
                        <button
                          key={product.product_sku}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => addProductSku(product.product_sku)}
                        >
                          <span className="min-w-0 truncate">{product.product_commercial_name || product.product_sku}</span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{product.product_sku}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedProductSkus.length === 0 ? (
                      <span className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">Sin productos seleccionados</span>
                    ) : (
                      selectedProductSkus.map((sku) => (
                        <Button key={sku} type="button" variant="secondary" size="sm" className="gap-1" onClick={() => setSelectedProductSkus((prev) => prev.filter((item) => item !== sku))}>
                          {sku}<X className="h-3 w-3" />
                        </Button>
                      ))
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scope" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Alcance de la Promocion</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Aplica a</Label>
                    <Select value={scope} onValueChange={setScope}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCOPE_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {scope === 'products' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar productos por SKU, nombre o marca" />
                      </div>
                      {loadingProductOptions && <p className="text-xs text-muted-foreground">Buscando productos...</p>}
                      {productOptions.length > 0 && (
                        <div className="rounded-md border divide-y">
                          {productOptions.map((product) => (
                            <button
                              key={product.product_sku}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => addProductSku(product.product_sku)}
                            >
                              <span className="min-w-0 truncate">{product.product_commercial_name || product.product_sku}</span>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">{product.product_sku}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {selectedProductSkus.map((sku) => (
                          <Button key={sku} type="button" variant="secondary" size="sm" className="gap-1" onClick={() => setSelectedProductSkus((prev) => prev.filter((item) => item !== sku))}>
                            {sku}<X className="h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {scope === 'customers' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Buscar clientes por nombre" />
                      </div>
                      {loadingCustomerOptions && <p className="text-xs text-muted-foreground">Buscando clientes...</p>}
                      {customerOptions.length > 0 && (
                        <div className="rounded-md border divide-y">
                          {customerOptions.map((customer) => {
                            const id = String(customer.id || '');
                            return (
                              <button
                                key={id}
                                type="button"
                                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={() => addCustomerId(id)}
                              >
                                <span className="min-w-0 truncate">{String(customer.customer_full_name || `Cliente ${id}`)}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{String(customer.customer_government_id || id)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {selectedCustomerIds.map((id) => (
                          <Button key={id} type="button" variant="secondary" size="sm" className="gap-1" onClick={() => setSelectedCustomerIds((prev) => prev.filter((item) => item !== id))}>
                            Cliente {id}<X className="h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {scope === 'product_filters' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2"><Label>Marca</Label><Input value={productFilterBrand} onChange={(e) => setProductFilterBrand(e.target.value)} placeholder="Marca" /></div>
                      <div className="space-y-2"><Label>Categoria</Label><Input value={productFilterCategory} onChange={(e) => setProductFilterCategory(e.target.value)} placeholder="Categoria" /></div>
                      <div className="space-y-2"><Label>Linea</Label><Input value={productFilterLine} onChange={(e) => setProductFilterLine(e.target.value)} placeholder="Linea" /></div>
                      <div className="space-y-2"><Label>Especie</Label><Input value={productFilterSpecies} onChange={(e) => setProductFilterSpecies(e.target.value)} placeholder="Especie objetivo" /></div>
                    </div>
                  )}

                  {scope === 'customer_segment' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Segmento comercial</Label>
                        <Select value={segment} onValueChange={setSegment}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SEGMENT_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2"><Label>Tipo de negocio</Label><Input value={customerFilterBusinessType} onChange={(e) => setCustomerFilterBusinessType(e.target.value)} placeholder="Veterinaria" /></div>
                        <div className="space-y-2"><Label>Ciudad</Label><Input value={customerFilterCity} onChange={(e) => setCustomerFilterCity(e.target.value)} placeholder="Bogota" /></div>
                        <div className="space-y-2"><Label>Departamento</Label><Input value={customerFilterState} onChange={(e) => setCustomerFilterState(e.target.value)} placeholder="Cundinamarca" /></div>
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="mechanics" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">Mecanica de la Promocion</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-6 pt-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Si el cliente compra... (Condicion)</h4>
                    <div className="space-y-2">
                      <Label>Tipo de Condicion</Label>
                      <Select value={conditionType} onValueChange={setConditionType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONDITION_TYPES.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {conditionType === 'none' ? (
                      <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">
                        El beneficio aplica directo al alcance y productos definidos.
                      </div>
                    ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {conditionType === 'product_mix' && (
                        <div className="space-y-2">
                          <Label>SKUs requeridos en la mezcla</Label>
                          <Input
                            placeholder="SKU001, SKU002"
                            value={conditionValue}
                            onChange={(e) => setConditionValue(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>
                          {conditionType === 'min_amount' && 'Monto Minimo ($)'}
                          {conditionType === 'min_quantity' && 'Cantidad Minima'}
                          {conditionType === 'buy_x_get_y' && 'Cantidad a Comprar'}
                          {conditionType === 'product_mix' && 'Cantidad Total Minima'}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={conditionQty || ''}
                          onChange={(e) => setConditionQty(parseFloat(e.target.value) || 0)}
                          placeholder={conditionType === 'min_amount' ? '500000' : '10'}
                        />
                      </div>
                    </div>
                    )}
                  </div>

                  <div className="p-4 bg-green-500/10 rounded-lg space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Entonces recibe... (Beneficio)</h4>
                    <div className="space-y-2">
                      <Label>Tipo de Beneficio</Label>
                      <Select value={rewardType} onValueChange={setRewardType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REWARD_TYPES.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        {rewardType === 'free_product' && 'Cantidad a Regalar'}
                        {rewardType === 'discount_percent' && 'Porcentaje de Descuento (%)'}
                        {rewardType === 'discount_amount' && 'Descuento Fijo ($)'}
                        {rewardType === 'price_override' && 'Precio Especial ($)'}
                        {rewardType === 'cashback_credit' && 'Credito Posterior ($)'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step={rewardType === 'discount_percent' ? 0.1 : 1}
                        value={rewardValue || ''}
                        onChange={(e) => setRewardValue(parseFloat(e.target.value) || 0)}
                        placeholder={rewardType === 'discount_percent' ? '15' : '2'}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="financial" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">Control Financiero</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="estimatedCost">Costo Estimado ($)</Label>
                      <Input id="estimatedCost" type="number" min={0} value={estimatedCost || ''} onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)} placeholder="1000000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxRedemptions">Max. Redenciones (opcional)</Label>
                      <Input id="maxRedemptions" type="number" min={0} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value ? parseInt(e.target.value, 10) : '')} placeholder="500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tratamiento Contable (ERP)</Label>
                    <Select value={accountingTreatment} onValueChange={setAccountingTreatment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACCOUNTING_TREATMENTS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Define como se reflejara esta promocion en SAP Business One</p>
                  </div>

                  {estimatedCost > 0 && !budgetError && (
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Costo Estimado</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(estimatedCost)}</span>
                      </div>
                      {spendableBalance !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Saldo gastable disponible: {formatCurrency(spendableBalance)}
                        </p>
                      )}
                    </div>
                  )}

                  {budgetError && (
                    <Alert variant="destructive" className="border-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="font-medium">{budgetError}</AlertDescription>
                    </Alert>
                  )}

                  {approvalWarning && !budgetError && (
                    <Alert className="border-amber-300 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="font-medium text-amber-800">{approvalWarning}</AlertDescription>
                    </Alert>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="grid gap-2 pt-6 mt-6 border-t sm:grid-cols-2">
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting || !!budgetError}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? 'Actualizando...' : 'Guardando...'}
                  </>
                ) : (
                  isEditing ? 'Actualizar Promocion' : 'Guardar Promocion'
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
