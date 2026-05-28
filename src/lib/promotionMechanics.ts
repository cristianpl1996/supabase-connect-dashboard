import type {
  BonusProductType,
  BundleRule,
  DiscountType,
  MechanicBenefitType,
  MechanicConditionType,
  PromotionMechanicData,
  PromotionType,
  PromoMechanic,
  RequiredPromotionProduct,
} from "@/lib/api";

export const PROMOTION_TYPE_OPTIONS: Array<{ value: PromotionType; label: string; helpText?: string }> = [
  { value: "descuento_linea", label: "Descuento en Linea", helpText: "Descuento directo sobre todos los productos seleccionados, sin condiciones adicionales." },
  { value: "bonificacion_cantidad", label: "Bonificacion (Precio Cero)", helpText: "Compra X unidades y lleva N gratis al precio cero. Ideal para 10+1, 20+2, etc." },
  { value: "precio_especial", label: "Precio Especial", helpText: "Precio pactado para un producto de la seleccion." },
  { value: "descuento_volumen", label: "Descuento por Volumen", helpText: "Descuento al alcanzar un monto o cantidad minima de compra." },
  { value: "bonificacion_volumen", label: "Bonificacion por Volumen", helpText: "Producto gratis al alcanzar un minimo de compra." },
  { value: "combo", label: "Combo de Productos", helpText: "Beneficio al comprar una combinacion de productos juntos." },
];

export const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: "percentage", label: "Porcentaje (%)" },
  { value: "fixed", label: "Valor fijo ($)" },
];

export const MINIMUM_TYPE_OPTIONS = [
  { value: "minimum_amount", label: "Monto minimo ($)" },
  { value: "minimum_quantity", label: "Cantidad minima (uds)" },
] as const;

export const COMBO_BENEFIT_OPTIONS: Array<{ value: MechanicBenefitType; label: string }> = [
  { value: "percentage_discount", label: "Descuento porcentual" },
  { value: "fixed_discount", label: "Descuento fijo" },
  { value: "bonus_product", label: "Producto bonificado" },
];

export const BUNDLE_RULE_OPTIONS: Array<{ value: BundleRule; label: string }> = [
  { value: "all_required", label: "Debe comprar todos los productos" },
  { value: "any_required", label: "Puede comprar cualquiera de los productos" },
];

export const BONUS_PRODUCT_TYPE_OPTIONS: Array<{ value: BonusProductType; label: string; disabled?: boolean }> = [
  { value: "same_product", label: "Mismo producto" },
  { value: "different_product", label: "Otro producto", disabled: true },
];

export interface PromotionMechanicFormState {
  promotionType: PromotionType | "";
  conditionType: MechanicConditionType | "";
  benefitType: MechanicBenefitType | "";
  mechanic: PromotionMechanicData;
}

export const EMPTY_MECHANIC: PromotionMechanicData = {
  condition_type: null,
  benefit_type: null,
  discount_type: null,
  discount_value: null,
  special_price: null,
  special_price_product_id: null,
  special_price_product_name: null,
  base_product_id: null,
  base_product_name: null,
  base_quantity: null,
  bonus_quantity: null,
  bonus_product_type: "same_product",
  bonus_product_id: null,
  bonus_product_name: null,
  minimum_amount: null,
  minimum_quantity: null,
  bundle_rule: null,
  required_products: [],
};

export function resetMechanicForPromotionType(nextType: PromotionType | ""): PromotionMechanicFormState {
  const defaults: Record<PromotionType, { conditionType: MechanicConditionType | ""; benefitType: MechanicBenefitType | "" }> = {
    descuento_linea: { conditionType: "none", benefitType: "percentage_discount" },
    bonificacion_cantidad: { conditionType: "minimum_quantity", benefitType: "bonus_units" },
    precio_especial: { conditionType: "none", benefitType: "special_price" },
    descuento_volumen: { conditionType: "minimum_amount", benefitType: "percentage_discount" },
    bonificacion_volumen: { conditionType: "minimum_amount", benefitType: "bonus_product" },
    combo: { conditionType: "product_mix", benefitType: "percentage_discount" },
  };
  const d = nextType ? defaults[nextType] : { conditionType: "" as const, benefitType: "" as const };
  const mechanic = { ...EMPTY_MECHANIC };
  if (nextType === "descuento_linea" || nextType === "descuento_volumen") {
    mechanic.discount_type = "percentage";
  }
  return { promotionType: nextType, conditionType: d.conditionType, benefitType: d.benefitType, mechanic };
}

export function createRequiredProduct(): RequiredPromotionProduct {
  return { product_id: "", minimum_quantity: 1, product_name: null };
}

export function deriveConditionTypeAndBenefitType(state: PromotionMechanicFormState): { conditionType: MechanicConditionType; benefitType: MechanicBenefitType } {
  const { promotionType, conditionType, mechanic } = state;
  if (promotionType === "descuento_linea") {
    const benefit = mechanic.discount_type === "fixed" ? "fixed_discount" : "percentage_discount";
    return { conditionType: "none", benefitType: benefit };
  }
  if (promotionType === "bonificacion_cantidad") return { conditionType: "minimum_quantity", benefitType: "bonus_units" };
  if (promotionType === "precio_especial") return { conditionType: mechanic.minimum_quantity ? "minimum_quantity" : "none", benefitType: "special_price" };
  if (promotionType === "descuento_volumen") {
    const benefit = mechanic.discount_type === "fixed" ? "fixed_discount" : "percentage_discount";
    return { conditionType: (conditionType || "minimum_amount") as MechanicConditionType, benefitType: benefit };
  }
  if (promotionType === "bonificacion_volumen") return { conditionType: (conditionType || "minimum_amount") as MechanicConditionType, benefitType: "bonus_product" };
  if (promotionType === "combo") return { conditionType: "product_mix", benefitType: (state.benefitType || "percentage_discount") as MechanicBenefitType };
  return { conditionType: "none", benefitType: "percentage_discount" };
}

export function buildPromotionMechanicPayload(state: PromotionMechanicFormState) {
  const { conditionType, benefitType } = deriveConditionTypeAndBenefitType(state);
  const mechanic: PromotionMechanicData = {
    ...EMPTY_MECHANIC,
    ...state.mechanic,
    condition_type: conditionType,
    benefit_type: benefitType,
  };
  const promotionType = state.promotionType as PromotionType;
  let accounting_treatment = "descuento_pie";
  if (promotionType === "bonificacion_cantidad" || promotionType === "bonificacion_volumen" || benefitType === "bonus_product" || benefitType === "bonus_units") {
    accounting_treatment = "bonificacion_precio_cero";
  } else if (promotionType === "precio_especial" || benefitType === "special_price") {
    accounting_treatment = "precio_especial";
  }
  return {
    promotion_type: promotionType,
    condition_type: conditionType,
    benefit_type: benefitType,
    reward_type: null,
    condition_config: null,
    reward_config: null,
    mechanic,
    accounting_treatment,
  };
}

export function validatePromotionMechanic(state: PromotionMechanicFormState): string | null {
  if (!state.promotionType) return "Debes seleccionar el tipo de promocion";
  const { promotionType } = state;
  const mechanic = buildPromotionMechanicPayload(state).mechanic;
  const positiveMoney = (v: number | null | undefined) => v != null && v > 0;
  const positiveInt = (v: number | null | undefined) => Number.isInteger(v) && Number(v) > 0;
  const validPct = (v: number | null | undefined) => v != null && v > 0 && v <= 100;

  if (promotionType === "descuento_linea") {
    if (mechanic.discount_type !== "percentage") return "El descuento en linea solo admite porcentaje";
    if (!validPct(mechanic.discount_value)) return "El porcentaje debe ser mayor a 0 y maximo 100";
  }
  if (promotionType === "bonificacion_cantidad") {
    if (!positiveInt(mechanic.base_quantity)) return "La cantidad a comprar debe ser un entero mayor a 0";
    if (!positiveInt(mechanic.bonus_quantity)) return "La cantidad bonificada debe ser un entero mayor a 0";
    if (mechanic.bonus_product_type === "different_product" && !mechanic.bonus_product_id) return "Debes seleccionar el producto bonificado";
  }
  if (promotionType === "precio_especial") {
    if (!positiveMoney(mechanic.special_price)) return "El precio especial debe ser mayor a 0";
    if (mechanic.condition_type === "minimum_quantity" && !positiveInt(mechanic.minimum_quantity)) return "La cantidad minima debe ser un entero mayor a 0";
  }
  if (promotionType === "descuento_volumen") {
    if (mechanic.condition_type === "minimum_amount" && !positiveMoney(mechanic.minimum_amount)) return "El monto minimo debe ser mayor a 0";
    if (mechanic.condition_type === "minimum_quantity" && !positiveInt(mechanic.minimum_quantity)) return "La cantidad minima debe ser un entero mayor a 0";
    if (!mechanic.discount_type) return "Debes definir el tipo de descuento";
    if (mechanic.discount_type === "percentage" && !validPct(mechanic.discount_value)) return "El porcentaje debe ser mayor a 0 y maximo 100";
    if (mechanic.discount_type === "fixed" && !positiveMoney(mechanic.discount_value)) return "El valor del descuento debe ser mayor a 0";
  }
  if (promotionType === "bonificacion_volumen") {
    if (mechanic.condition_type === "minimum_amount" && !positiveMoney(mechanic.minimum_amount)) return "El monto minimo debe ser mayor a 0";
    if (mechanic.condition_type === "minimum_quantity" && !positiveInt(mechanic.minimum_quantity)) return "La cantidad minima debe ser un entero mayor a 0";
    if (!mechanic.bonus_product_id) return "Debes seleccionar el producto bonificado";
    if (!positiveInt(mechanic.bonus_quantity)) return "La cantidad bonificada debe ser un entero mayor a 0";
  }
  if (promotionType === "combo") {
    if ((mechanic.required_products || []).length < 2) return "El combo debe tener minimo 2 productos";
    if ((mechanic.required_products || []).some((item) => !item.product_id || !positiveInt(item.minimum_quantity ?? null))) return "Cada producto del combo debe tener producto y cantidad minima";
    if (!mechanic.bundle_rule) return "Debes definir la regla del combo";
    if (mechanic.benefit_type === "percentage_discount" && !validPct(mechanic.discount_value)) return "El porcentaje debe ser mayor a 0 y maximo 100";
    if (mechanic.benefit_type === "fixed_discount" && !positiveMoney(mechanic.discount_value)) return "El valor del descuento debe ser mayor a 0";
    if (mechanic.benefit_type === "bonus_product" && (!mechanic.bonus_product_id || !positiveInt(mechanic.bonus_quantity))) return "Debes definir el producto y la cantidad bonificada";
  }
  return null;
}

export function inferMechanicStateFromPromotion(mechanic?: PromoMechanic | null): PromotionMechanicFormState {
  if (!mechanic) return resetMechanicForPromotionType("");
  const promotionType = (mechanic.promotion_type || "") as PromotionType | "";
  const normalized = { ...EMPTY_MECHANIC, ...(mechanic.mechanic || {}) };
  normalized.bonus_product_type = normalized.bonus_product_type || "same_product";
  if ((promotionType === "descuento_linea" || promotionType === "descuento_volumen") && !normalized.discount_type) {
    normalized.discount_type = "percentage";
  }
  return {
    promotionType,
    conditionType: (normalized.condition_type || mechanic.condition_type || "") as MechanicConditionType | "",
    benefitType: (normalized.benefit_type || mechanic.benefit_type || "") as MechanicBenefitType | "",
    mechanic: normalized,
  };
}

export function summarizePromotionMechanic(state: PromotionMechanicFormState): string {
  if (!state.promotionType) return "Selecciona el tipo de promocion para ver el resumen.";
  const mechanic = buildPromotionMechanicPayload(state).mechanic;

  if (state.promotionType === "descuento_linea") {
    const val = mechanic.discount_type === "percentage" ? `${mechanic.discount_value || 0}%` : formatCurrency(mechanic.discount_value);
    return `Descuento de ${val} sobre todos los productos seleccionados.`;
  }
  if (state.promotionType === "bonificacion_cantidad") {
    const bqty = mechanic.bonus_quantity || 0;
    const bbase = mechanic.base_quantity || 0;
    if (mechanic.bonus_product_type === "different_product") {
      return `Compra ${bbase} uds. → recibe ${bqty} uds. de ${mechanic.bonus_product_name || "producto bonificado"} gratis.`;
    }
    return `Compra ${bbase} uds. → recibe ${bqty} uds. del mismo producto gratis.`;
  }
  if (state.promotionType === "precio_especial") {
    return mechanic.minimum_quantity
      ? `Los productos seleccionados a precio especial de ${formatCurrency(mechanic.special_price)} desde ${mechanic.minimum_quantity} unidades.`
      : `Los productos seleccionados a precio especial de ${formatCurrency(mechanic.special_price)}.`;
  }
  if (state.promotionType === "descuento_volumen") {
    const threshold = mechanic.condition_type === "minimum_amount" ? formatCurrency(mechanic.minimum_amount) : `${mechanic.minimum_quantity || 0} unidades`;
    const val = mechanic.discount_type === "percentage" ? `${mechanic.discount_value || 0}%` : formatCurrency(mechanic.discount_value);
    return `Compra minima de ${threshold}: descuento de ${val}.`;
  }
  if (state.promotionType === "bonificacion_volumen") {
    const threshold = mechanic.condition_type === "minimum_amount" ? formatCurrency(mechanic.minimum_amount) : `${mechanic.minimum_quantity || 0} unidades`;
    return `Compra minima de ${threshold}: recibe ${mechanic.bonus_quantity || 0} unidad(es) de ${mechanic.bonus_product_name || "producto bonificado"} a precio cero.`;
  }
  if (state.promotionType === "combo") {
    const names = (mechanic.required_products || []).map((p) => p.product_name || p.product_id).filter(Boolean);
    const combo = names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : (names[0] || "los productos seleccionados");
    if (mechanic.benefit_type === "percentage_discount") return `Si el cliente compra ${combo}: descuento del ${mechanic.discount_value || 0}%.`;
    if (mechanic.benefit_type === "fixed_discount") return `Si el cliente compra ${combo}: descuento fijo de ${formatCurrency(mechanic.discount_value)}.`;
    if (mechanic.benefit_type === "bonus_product") return `Si el cliente compra ${combo}: recibe ${mechanic.bonus_quantity || 0} unidad(es) de ${mechanic.bonus_product_name || "producto bonificado"}.`;
  }
  return "Promocion comercial configurada.";
}

const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 });

function formatCurrency(value: number | null | undefined) {
  return COP_FORMATTER.format(value || 0);
}
