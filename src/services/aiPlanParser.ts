import { generateAiText } from '@/lib/api';

export type PlanConceptKey =
  | 'Desc_Pie_Factura'
  | 'Rebate_SellIn'
  | 'Rebate_SellOut'
  | 'Marketing'
  | 'Pronto_Pago'
  | 'Otro';

export interface ContractAnalysisFund {
  concept_key: PlanConceptKey;
  custom_concept?: string;
  type: 'percentage' | 'fixed';
  value: number;
}

export interface ContractAnalysisResult {
  brand_name: string;
  year: number;
  annual_goal: number;
  invoice_discount_perc: number;
  rebate_sell_in_perc: number;
  rebate_sell_out_perc: number;
  marketing_perc: number;
  marketing_fixed_value: number;
  financial_discount_perc: number;
  total_margin_perc: number;
  funds: ContractAnalysisFund[];
}

const PLAN_ANALYSIS_MODEL = (import.meta.env.VITE_PLAN_ANALYSIS_MODEL as string | undefined) ?? 'gpt-5.4';
const PLAN_ANALYSIS_SYSTEM_PROMPT = `Eres un experto en análisis de contratos comerciales farmacéuticos y agropecuarios en Colombia. Tu única tarea es leer el PDF adjunto y extraer los datos del acuerdo comercial anual entre un laboratorio y un distribuidor.

Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto adicional, con esta estructura:
{
  "brand_name": "Nombre del laboratorio o marca tal como aparece en el contrato",
  "year": 2026,
  "annual_goal": 850000000,
  "invoice_discount_perc": 0,
  "rebate_sell_in_perc": 0,
  "rebate_sell_out_perc": 0,
  "marketing_perc": 0,
  "marketing_fixed_value": 0,
  "financial_discount_perc": 0,
  "total_margin_perc": 0,
  "funds": []
}

INSTRUCCIONES DE EXTRACCIÓN:

brand_name: Busca el nombre del laboratorio, fabricante o marca. Puede aparecer como "Laboratorio X", "Marca comercial", "Proveedor", "Fabricante".

year: Año de vigencia del acuerdo. Busca "Año", "Vigencia", "Período", "2025", "2026", "2027".

annual_goal: Meta anual de compras o ventas en pesos colombianos. Busca términos como "Meta de compra", "Objetivo de venta", "Target anual", "Cuota anual", "Goal". Número entero sin separadores.

invoice_discount_perc: Descuento en pie de factura. Busca "Desc. pie de factura", "Descuento comercial", "Descuento de contado", "Dto. factura", "Descuento directo". Solo el porcentaje numérico.

rebate_sell_in_perc: Rebate sobre compras (sell-in). Busca "Rebate sell-in", "Rebate de compra", "Bonificación sell-in", "Rappel de entrada".

rebate_sell_out_perc: Rebate sobre ventas (sell-out). Busca "Rebate sell-out", "Rebate de venta", "Bonificación sell-out", "Rappel de salida".

marketing_perc: Apoyo en marketing como porcentaje. Busca "Marketing", "Mercadeo", "Apoyo comercial %", "Inversión marketing".

marketing_fixed_value: Apoyo en marketing como valor fijo en pesos. Busca "Apoyo fijo", "Valor fijo de marketing", "$ marketing". Si no existe, usa 0.

financial_discount_perc: Descuento financiero o pronto pago. Busca "Pronto pago", "Descuento financiero", "Descuento por pago anticipado".

total_margin_perc: Suma de TODOS los porcentajes detectados (invoice_discount_perc + rebate_sell_in_perc + rebate_sell_out_perc + marketing_perc + financial_discount_perc + cualquier otro porcentaje en funds de tipo "percentage").

funds: Lista de TODOS los conceptos de negociación encontrados en el contrato. Para cada concepto usa:
  - concept_key: uno de estos valores exactos: "Desc_Pie_Factura", "Rebate_SellIn", "Rebate_SellOut", "Marketing", "Pronto_Pago", "Otro"
  - custom_concept: solo si concept_key es "Otro", escribe el nombre exacto del concepto tal como aparece en el contrato
  - type: "percentage" si es un porcentaje, "fixed" si es un valor monetario fijo
  - value: el valor numérico (porcentaje sin símbolo %, o monto en pesos sin separadores)

REGLAS GENERALES:
- Usa 0 para cualquier campo que no encuentres en el contrato.
- Los porcentajes van sin símbolo: 3.5% → 3.5
- Los montos van sin puntos ni comas de separación: $1.200.000 → 1200000
- Si un concepto no está en la lista oficial, usa concept_key="Otro" y pon el nombre real en custom_concept.
- Si hay tablas de descuentos por volumen, extrae el descuento base o el porcentaje más representativo.
- Responde SOLO el JSON. Sin explicaciones, sin comentarios, sin markdown.`;



async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo PDF.'));
    reader.readAsDataURL(file);
  });
}

function parseAnalysisResponse(text: string): ContractAnalysisResult {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  return JSON.parse(cleaned) as ContractAnalysisResult;
}

export async function analyzeContract(file: File): Promise<ContractAnalysisResult> {
  const base64 = await fileToBase64(file);
  const response = await generateAiText({
    model: PLAN_ANALYSIS_MODEL,
    system_prompt: PLAN_ANALYSIS_SYSTEM_PROMPT,
    user_input: 'Analiza el contrato comercial adjunto y extrae todos los datos del acuerdo. Devuelve exclusivamente el JSON solicitado.',
    temperature: 0.1,
    max_output_tokens: 2000,
    input_files: [
      {
        filename: file.name || 'contrato.pdf',
        mime_type: file.type || 'application/pdf',
        data_base64: base64,
      },
    ],
  });

  try {
    return parseAnalysisResponse(response.text);
  } catch {
    console.error('AI plan parser received non-JSON response:', response.text);
    throw new Error('La IA no pudo extraer datos validos del contrato. Intenta con otro PDF.');
  }
}
