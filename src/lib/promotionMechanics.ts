import type {
  BonusProductType,
  BundleRule,
  CreditApplicationMoment,
  CreditType,
  DiscountType,
  MechanicBenefitType,
  MechanicConditionType,
  PromotionMechanicData,
  PromotionType,
  PromoMechanic,
  RequiredPromotionProduct,
} from "@/lib/api";

export const PROMOTION_TYPE_OPTIONS: Array<{ value: PromotionType; label: string; helpText?: string }> = [
  { value: "direct_discount", label: "Descuento directo" },
  { value: "special_price", label: "Precio especial" },
  { value: "minimum_purchase", label: "Compra minima" },
  { value: "quantity_bonus", label: "Bonificacion por cantidad", helpText: "Usa esta opcion para promociones tipo 10+1, 20+2 o similares." },
  { value: "product_bundle", label: "Combo de productos", helpText: "Usa esta opcion cuando la promocion depende de comprar una combinacion de productos." },
  { value: "minimum_purchase_bonus", label: "Producto bonificado por compra minima" },
  { value: "credit_note", label: "Credito / nota posterior", helpText: "Usa esta opcion cuando el beneficio se reconoce despues de validar la compra." },
];

export const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: "percentage", label: "Porcentaje" },
  { value: "fixed", label: "Valor fijo" },
];

export const APPLIES_TO_OPTIONS = [
  { value: "product", label: "Producto" },
  { value: "brand", label: "Marca" },
  { value: "category", label: "Categoria" },
  { value: "entire_order", label: "Toda la compra" },
] as const;

export const MINIMUM_TYPE_OPTIONS = [
  { value: "minimum_amount", label: "Monto minimo" },
  { value: "minimum_quantity", label: "Cantidad minima" },
] as const;

export const PURCHASE_BENEFIT_OPTIONS: Array<{ value: MechanicBenefitType; label: string }> = [
  { value: "percentage_discount", label: "Descuento porcentual" },
  { value: "fixed_discount", label: "Descuento fijo" },
  { value: "bonus_product", label: "Producto bonificado" },
  { value: "credit_note", label: "Credito posterior" },
];

export const BUNDLE_BENEFIT_OPTIONS: Array<{ value: MechanicBenefitType; label: string }> = [
  { value: "percentage_discount", label: "Descuento porcentual" },
  { value: "fixed_discount", label: "Descuento fijo" },
  { value: "bonus_product", label: "Producto bonificado" },
  { value: "special_price", label: "Precio especial" },
];

export const BUNDLE_RULE_OPTIONS: Array<{ value: BundleRule; label: string }> = [
  { value: "all_required", label: "Debe comprar todos los productos" },
  { value: "any_required", label: "Puede comprar cualquiera de los productos" },
];

export const BONUS_PRODUCT_TYPE_OPTIONS: Array<{ value: BonusProductType; label: string }> = [
  { value: "same_product", label: "Mismo producto" },
  { value: "different_product", label: "Otro producto" },
];

export const CREDIT_TYPE_OPTIONS: Array<{ value: CreditType; label: string }> = [
  { value: "percentage", label: "Porcentaje" },
  { value: "fixed", label: "Valor fijo" },
];

export const CREDIT_APPLICATION_OPTIONS: Array<{ value: CreditApplicationMoment; label: string }> = [
  { value: "promotion_end", label: "Al cierre de la promocion" },
  { value: "manual", label: "Manual" },
  { value: "after_validation", label: "Posterior a validacion" },
];

export const SPECIFIC_CONDITION_OPTIONS = [
  { value: "minimum_amount", label: "Monto minimo" },
  { value: "minimum_quantity", label: "Cantidad minima" },
  { value: "specific_products", label: "Compra de productos especificos" },
] as const;

export interface PromotionMechanicFormState {
  promotionType: PromotionType | "";
  conditionType: MechanicConditionType | "";
  benefitType: MechanicBenefitType | "";
  mechanic: PromotionMechanicData;
}

export const EMPTY_MECHANIC: PromotionMechanicData = {
  applies_to: null,
  minimum_amount: null,
  minimum_quantity: null,
  discount_type: null,
  discount_value: null,
  special_price: null,
  special_price_product_id: null,
  special_price_product_name: null,
  base_product_id: null,
  base_product_name: null,
  base_quantity: null,
  bonus_quantity: null,
  bonus_product_type: null,
  bonus_product_id: null,
  bonus_product_name: null,
  bundle_rule: null,
  required_products: [],
  credit_type: null,
  credit_value: null,
  application_moment: null,
  condition_type: null,
  benefit_type: null,
};

export const PROMOTION_MECHANIC_CONFIG: Record<PromotionType, { label: string; helpText?: string; derive: (state: PromotionMechanicFormState) => { conditionType: MechanicConditionType; benefitType: MechanicBenefitType } }> = {
  direct_discount: {
    label: "Descuento directo",
    derive: (state) => ({
      conditionType: (state.conditionType || (state.mechanic.minimum_amount ? "minimum_amount" : state.mechanic.minimum_quantity ? "minimum_quantity" : "none")) as MechanicConditionType,
      benefitType: (state.mechanic.discount_type === "fixed" ? "fixed_discount" : "percentage_discount"),
    }),
  },
  special_price: {
    label: "Precio especial",
    derive: (state) => ({
      conditionType: state.mechanic.minimum_quantity ? "minimum_quantity" : "none",
      benefitType: "special_price",
    }),
  },
  minimum_purchase: {
    label: "Compra minima",
    derive: (state) => ({
      conditionType: (state.conditionType || "minimum_amount") as MechanicConditionType,
      benefitType: (state.benefitType || "percentage_discount") as MechanicBenefitType,
    }),
  },
  quantity_bonus: {
    label: "Bonificacion por cantidad",
    helpText: "Usa esta opcion para promociones tipo 10+1, 20+2 o similares.",
    derive: () => ({ conditionType: "minimum_quantity", benefitType: "bonus_units" }),
  },
  product_bundle: {
    label: "Combo de productos",
    helpText: "Usa esta opcion cuando la promocion depende de comprar una combinacion de productos.",
    derive: (state) => ({ conditionType: "product_mix", benefitType: (state.benefitType || "percentage_discount") as MechanicBenefitType }),
  },
  minimum_purchase_bonus: {
    label: "Producto bonificado por compra minima",
    derive: (state) => ({ conditionType: (state.conditionType || "minimum_amount") as MechanicConditionType, benefitType: "bonus_product" }),
  },
  credit_note: {
    label: "Credito / nota posterior",
    helpText: "Usa esta opcion cuando el beneficio se reconoce despues de validar la compra.",
    derive: (state) => ({ conditionType: (state.conditionType || "minimum_amount") as MechanicConditionType, benefitType: "credit_note" }),
  },
};

export function resetMechanicForPromotionType(nextType: PromotionType | ""): PromotionMechanicFormState {
  return {
    promotionType: nextType,
    conditionType: nextType === "minimum_purchase" || nextType === "minimum_purchase_bonus" || nextType === "credit_note" ? "minimum_amount" : nextType === "product_bundle" ? "product_mix" : nextType === "quantity_bonus" ? "minimum_quantity" : "",
    benefitType: nextType === "minimum_purchase" ? "percentage_discount" : nextType === "product_bundle" ? "percentage_discount" : "",
    mechanic: { ...EMPTY_MECHANIC },
  };
}

export function createRequiredProduct(): RequiredPromotionProduct {
  return { product_id: "", minimum_quantity: 1, product_name: null };
}

export function deriveConditionTypeAndBenefitType(state: PromotionMechanicFormState): { conditionType: MechanicConditionType; benefitType: MechanicBenefitType } {
  if (!state.promotionType) {
    return { conditionType: "none", benefitType: "percentage_discount" };
  }
  return PROMOTION_MECHANIC_CONFIG[state.promotionType].derive(state);
}

export function buildPromotionMechanicPayload(state: PromotionMechanicFormState) {
  const { conditionType, benefitType } = deriveConditionTypeAndBenefitType(state);
  const mechanic: PromotionMechanicData = {
    ...EMPTY_MECHANIC,
    ...state.mechanic,
    condition_type: conditionType,
    benefit_type: benefitType,
  };
  return {
    promotion_type: state.promotionType,
    condition_type: conditionType,
    benefit_type: benefitType,
    reward_type: null,
    condition_config: null,
    reward_config: null,
    mechanic,
    accounting_treatment:
      state.promotionType === "credit_note" || benefitType === "credit_note"
        ? "nota_credito_posterior"
        : state.promotionType === "quantity_bonus" || state.promotionType === "minimum_purchase_bonus" || benefitType === "bonus_product" || benefitType === "bonus_units"
          ? "bonificacion_precio_cero"
          : benefitType === "special_price"
            ? "precio_especial"
            : "descuento_pie",
  };
}

export function validatePromotionMechanic(state: PromotionMechanicFormState): string | null {
  if (!state.promotionType) return "Debes seleccionar el tipo de promocion";
  const { promotionType } = state;
  const mechanic = buildPromotionMechanicPayload(state).mechanic || {};
  const positiveMoney = (value: number | null | undefined) => value !== null && value !== undefined && value > 0;
  const positiveInt = (value: number | null | undefined) => Number.isInteger(value) && Number(value) > 0;
  const validPercentage = (value: number | null | undefined) => value !== null && value !== undefined && value > 0 && value <= 100;
  if (promotionType === "direct_discount") {
    if (!mechanic.applies_to) return "Debes definir sobre que aplica el descuento";
    if (!mechanic.discount_type) return "Debes definir el tipo de descuento";
    if (mechanic.discount_type === "percentage" && !validPercentage(mechanic.discount_value)) return "El porcentaje de descuento debe ser mayor a 0 y menor o igual a 100";
    if (mechanic.discount_type === "fixed" && !positiveMoney(mechanic.discount_value)) return "El valor del descuento debe ser mayor a 0";
    if (mechanic.condition_type === "minimum_amount" && !positiveMoney(mechanic.minimum_amount)) return "El monto minimo debe ser mayor a 0";
    if (mechanic.condition_type === "minimum_quantity" && !positiveInt(mechanic.minimum_quantity)) return "La cantidad minima debe ser un entero mayor a 0";
  }
  if (promotionType === "special_price") {
    if (!mechanic.special_price_product_id) return "Debes seleccionar el producto con precio especial";
    if (!positiveMoney(mechanic.special_price)) return "El precio especial debe ser mayor a 0";
    if (mechanic.condition_type === "minimum_quantity" && !positiveInt(mechanic.minimum_quantity)) return "La cantidad minima debe ser un entero mayor a 0";
  }
  if (promotionType === "quantity_bonus") {
    if (!mechanic.base_product_id) return "Debes seleccionar el producto base";
    if (!positiveInt(mechanic.base_quantity)) return "La cantidad que debe comprar debe ser un entero mayor a 0";
    if (!positiveInt(mechanic.bonus_quantity)) return "La cantidad bonificada debe ser un entero mayor a 0";
    if (!mechanic.bonus_product_type) return "Debes definir el producto bonificado";
    if (mechanic.bonus_product_type === "different_product" && !mechanic.bonus_product_id) return "Debes seleccionar el producto bonificado";
  }
  if (promotionType === "product_bundle") {
    if ((mechanic.required_products || []).length < 2) return "El combo debe tener minimo 2 productos requeridos";
    if ((mechanic.required_products || []).some((item) => !item.product_id || !positiveInt(item.minimum_quantity ?? null))) return "Cada producto del combo debe tener producto y cantidad minima";
    if (!mechanic.bundle_rule) return "Debes definir la regla del combo";
    if (mechanic.benefit_type === "percentage_discount" && !validPercentage(mechanic.discount_value)) return "El porcentaje de descuento debe ser mayor a 0 y menor o igual a 100";
    if (mechanic.benefit_type === "fixed_discount" && !positiveMoney(mechanic.discount_value)) return "El valor del descuento debe ser mayor a 0";
    if (mechanic.benefit_type === "bonus_product" && (!mechanic.bonus_product_id || !positiveInt(mechanic.bonus_quantity))) return "Debes definir el producto y la cantidad bonificada";
    if (mechanic.benefit_type === "special_price" && (!mechanic.special_price_product_id || !positiveMoney(mechanic.special_price))) return "Debes definir el producto y el precio especial";
  }
  if (promotionType === "minimum_purchase" || promotionType === "minimum_purchase_bonus" || promotionType === "credit_note") {
    if (mechanic.condition_type === "minimum_amount" && !positiveMoney(mechanic.minimum_amount)) return "El monto minimo debe ser mayor a 0";
    if (mechanic.condition_type === "minimum_quantity" && !positiveInt(mechanic.minimum_quantity)) return "La cantidad minima debe ser un entero mayor a 0";
    if (mechanic.condition_type === "specific_products" && !(mechanic.required_products || []).length) return "Debes agregar productos requeridos";
  }
  if (promotionType === "minimum_purchase") {
    if (mechanic.benefit_type === "percentage_discount" && !validPercentage(mechanic.discount_value)) return "El porcentaje de descuento debe ser mayor a 0 y menor o igual a 100";
    if (mechanic.benefit_type === "fixed_discount" && !positiveMoney(mechanic.discount_value)) return "El valor del descuento debe ser mayor a 0";
    if (mechanic.benefit_type === "bonus_product" && (!mechanic.bonus_product_id || !positiveInt(mechanic.bonus_quantity))) return "Debes definir el producto y la cantidad bonificada";
    if (mechanic.benefit_type === "credit_note") {
      if (!mechanic.credit_type) return "Debes definir el tipo de credito";
      if (mechanic.credit_type === "percentage" && !validPercentage(mechanic.credit_value)) return "El porcentaje de credito debe ser mayor a 0 y menor o igual a 100";
      if (mechanic.credit_type === "fixed" && !positiveMoney(mechanic.credit_value)) return "El valor del credito debe ser mayor a 0";
      if (!mechanic.application_moment) return "Debes definir el momento de aplicacion";
    }
  }
  if (promotionType === "minimum_purchase_bonus") {
    if (!mechanic.bonus_product_id || !positiveInt(mechanic.bonus_quantity)) return "Debes definir el producto y la cantidad bonificada";
  }
  if (promotionType === "credit_note") {
    if (!mechanic.credit_type) return "Debes definir el tipo de credito";
    if (mechanic.credit_type === "percentage" && !validPercentage(mechanic.credit_value)) return "El porcentaje de credito debe ser mayor a 0 y menor o igual a 100";
    if (mechanic.credit_type === "fixed" && !positiveMoney(mechanic.credit_value)) return "El valor del credito debe ser mayor a 0";
    if (!mechanic.application_moment) return "Debes definir el momento de aplicacion";
  }
  return null;
}

export function inferMechanicStateFromPromotion(mechanic?: PromoMechanic | null): PromotionMechanicFormState {
  if (!mechanic) return resetMechanicForPromotionType("");
  const promotionType = (mechanic.promotion_type || "") as PromotionType | "";
  const normalized = { ...EMPTY_MECHANIC, ...(mechanic.mechanic || {}) };
  return {
    promotionType,
    conditionType: (normalized.condition_type || mechanic.condition_type || "") as MechanicConditionType | "",
    benefitType: (normalized.benefit_type || mechanic.benefit_type || "") as MechanicBenefitType | "",
    mechanic: normalized,
  };
}

export function summarizePromotionMechanic(state: PromotionMechanicFormState): string {
  if (!state.promotionType) return "Selecciona el tipo de promocion para ver el resumen de la regla comercial.";
  const mechanic = buildPromotionMechanicPayload(state).mechanic || {};
  if (state.promotionType === "direct_discount") {
    const target = APPLIES_TO_OPTIONS.find((item) => item.value === mechanic.applies_to)?.label.toLowerCase() || "los productos seleccionados";
    const value = mechanic.discount_type === "percentage" ? `${mechanic.discount_value}%` : formatCurrency(mechanic.discount_value);
    return `Esta promocion aplica un descuento de ${value} sobre ${target}.`;
  }
  if (state.promotionType === "special_price") {
    const product = mechanic.special_price_product_name || "El producto seleccionado";
    return mechanic.minimum_quantity
      ? `${product} tendra un precio especial de ${formatCurrency(mechanic.special_price)} desde ${mechanic.minimum_quantity} unidades.`
      : `${product} tendra un precio especial de ${formatCurrency(mechanic.special_price)}.`;
  }
  if (state.promotionType === "quantity_bonus") {
    const base = mechanic.base_product_name || "Producto A";
    if (mechanic.bonus_product_type === "different_product") {
      return `Por cada ${mechanic.base_quantity || 0} unidades de ${base}, el cliente recibe ${mechanic.bonus_quantity || 0} unidad bonificada de ${mechanic.bonus_product_name || "Producto B"}.`;
    }
    return `Por cada ${mechanic.base_quantity || 0} unidades de ${base}, el cliente recibe ${mechanic.bonus_quantity || 0} unidad bonificada del mismo producto.`;
  }
  if (state.promotionType === "product_bundle") {
    const names = (mechanic.required_products || []).map((item) => item.product_name || item.product_id).filter(Boolean);
    const combo = names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : (names[0] || "los productos seleccionados");
    if (mechanic.benefit_type === "percentage_discount") return `Si el cliente compra ${combo}, recibe un descuento del ${mechanic.discount_value || 0}%.`;
    if (mechanic.benefit_type === "fixed_discount") return `Si el cliente compra ${combo}, recibe un descuento fijo de ${formatCurrency(mechanic.discount_value)}.`;
    if (mechanic.benefit_type === "bonus_product") return `Si el cliente compra ${combo}, recibe ${mechanic.bonus_quantity || 0} unidad bonificada de ${mechanic.bonus_product_name || "Producto bonificado"}.`;
    return `Si el cliente compra ${combo}, ${mechanic.special_price_product_name || "el producto seleccionado"} queda a ${formatCurrency(mechanic.special_price)}.`;
  }
  if (state.promotionType === "minimum_purchase") {
    const threshold = mechanic.condition_type === "minimum_amount" ? formatCurrency(mechanic.minimum_amount) : `${mechanic.minimum_quantity || 0} unidades`;
    if (mechanic.benefit_type === "percentage_discount") return `Si el cliente compra minimo ${threshold}, recibe un descuento del ${mechanic.discount_value || 0}%.`;
    if (mechanic.benefit_type === "fixed_discount") return `Si el cliente compra minimo ${threshold}, recibe un descuento fijo de ${formatCurrency(mechanic.discount_value)}.`;
    if (mechanic.benefit_type === "bonus_product") return `Si el cliente compra minimo ${threshold}, recibe ${mechanic.bonus_quantity || 0} unidad bonificada de ${mechanic.bonus_product_name || "Producto bonificado"}.`;
    return `Si el cliente compra minimo ${threshold}, se genera una nota credito de ${mechanic.credit_type === "percentage" ? `${mechanic.credit_value || 0}%` : formatCurrency(mechanic.credit_value)} ${CREDIT_APPLICATION_OPTIONS.find((item) => item.value === mechanic.application_moment)?.label.toLowerCase() || ""}.`;
  }
  if (state.promotionType === "minimum_purchase_bonus") {
    const threshold = mechanic.condition_type === "minimum_amount" ? formatCurrency(mechanic.minimum_amount) : mechanic.condition_type === "minimum_quantity" ? `${mechanic.minimum_quantity || 0} unidades` : "los productos requeridos";
    return `Si el cliente cumple con ${threshold}, recibe ${mechanic.bonus_quantity || 0} unidad bonificada de ${mechanic.bonus_product_name || "Producto bonificado"}.`;
  }
  const threshold = mechanic.condition_type === "minimum_amount" ? formatCurrency(mechanic.minimum_amount) : mechanic.condition_type === "minimum_quantity" ? `${mechanic.minimum_quantity || 0} unidades` : "los productos requeridos";
  return `Si el cliente compra minimo ${threshold}, se genera una nota credito de ${mechanic.credit_type === "percentage" ? `${mechanic.credit_value || 0}%` : formatCurrency(mechanic.credit_value)} ${CREDIT_APPLICATION_OPTIONS.find((item) => item.value === mechanic.application_moment)?.label.toLowerCase() || ""}.`;
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}
