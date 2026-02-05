import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDiEnLT_ocn3_1B-y1eFGfWaP_njAHxxoM";

const genAI = new GoogleGenerativeAI(API_KEY);

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
  funds: Array<{
    concept: string;
    type: "percentage" | "fixed";
    value: number;
  }>;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function analyzeContract(file: File): Promise<ContractAnalysisResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

  const base64Data = await fileToBase64(file);

  const prompt = `Actúa como un analista de contratos comerciales. Analiza este PDF adjunto.

══════════════════════════════════════════════════════════════════════
REGLA 1: LISTA CERRADA DE LABORATORIOS (OBLIGATORIO)
══════════════════════════════════════════════════════════════════════
Al identificar el laboratorio, DEBES elegir EXACTAMENTE uno de esta lista. No inventes ni acortes nombres:

- Elanco (Total 2025)
- Boehringer Ingelheim (Porcicultura)
- Boehringer Ingelheim (Pets)
- Zoetis (Porcicultura)
- Zoetis (Pets)
- Virbac
- MSD (Ganadería)
- MSD (Avicultura)
- Biogenesis Bago
- Ceva
- Ourofino
- Italcol
- Bayer
- Vetoquinol
- Agrovet Market
- Labyes

Si el PDF dice "Boehringer" sin especificar, busca en el texto pistas como "porcino", "cerdo", "swine" → usa "Boehringer Ingelheim (Porcicultura)". Si dice "mascota", "pet", "canino" → usa "Boehringer Ingelheim (Pets)".

Si no estás 100% seguro del segmento, usa el nombre genérico más cercano de la lista.

══════════════════════════════════════════════════════════════════════
REGLA 2: MAPEO EXACTO DE COLUMNAS (DATABASE KEYS)
══════════════════════════════════════════════════════════════════════
Tu salida JSON DEBE usar EXACTAMENTE estas keys (no cambies ni una letra):

- brand_name              → Para cruzar con el Selector (usa nombre de la lista)
- annual_goal             → Meta Anual (número sin formato)
- invoice_discount_perc   → Descuento Pie de Factura %
- rebate_sell_in_perc     → Rebate Sell-In % (compras)
- rebate_sell_out_perc    → Rebate Sell-Out % (ventas/evacuación)
- marketing_perc          → Marketing % (si es porcentaje)
- marketing_fixed_value   → Marketing valor fijo (si es monto $)
- financial_discount_perc → Pronto Pago / Descuento Financiero %
- total_margin_perc       → Suma de TODOS los porcentajes anteriores

══════════════════════════════════════════════════════════════════════
REGLA 3: DICCIONARIO DE CLASIFICACIÓN
══════════════════════════════════════════════════════════════════════
Clasifica cada porcentaje encontrado según estos criterios:

1. invoice_discount_perc: 'Descuento Base', 'Descuento Comercial', 'Off Invoice', 'Descuento Permanente'

2. rebate_sell_in_perc: 'Rappel', 'Bonificación por Volumen', 'Cumplimiento de Meta', 'Nota Crédito Anual', 'Quarterly Rebate'

3. rebate_sell_out_perc: 'Sell-out', 'Evacuación', 'Rotación', 'Transferencia', 'Descuento al Farmacéutico'

4. marketing_perc/marketing_fixed_value: 'Cooperativa', 'Visibilidad', 'Plan de Medios', 'Eventos', 'Apoyo Comercial'

5. financial_discount_perc: 'Pronto Pago', 'Descuento Financiero', 'Pago Anticipado'

══════════════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON PURO, SIN MARKDOWN)
══════════════════════════════════════════════════════════════════════
{
  "brand_name": "Nombre EXACTO de la lista",
  "year": 2025,
  "annual_goal": 000000,
  "invoice_discount_perc": 0,
  "rebate_sell_in_perc": 0,
  "rebate_sell_out_perc": 0,
  "marketing_perc": 0,
  "marketing_fixed_value": 0,
  "financial_discount_perc": 0,
  "total_margin_perc": 0,
  "funds": [
    { "concept": "Nombre original del PDF", "type": "percentage", "value": 0 }
  ]
}

IMPORTANTE:
- Normaliza porcentajes: 3% = 3.0
- total_margin_perc = suma de invoice_discount_perc + rebate_sell_in_perc + rebate_sell_out_perc + marketing_perc + financial_discount_perc
- El array 'funds' conserva TODOS los conceptos originales del PDF para auditoría.`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: file.type || "application/pdf",
        data: base64Data,
      },
    },
    { text: prompt },
  ]);

  const response = await result.response;
  const text = response.text();

  // Clean potential markdown wrapping
  let cleanedText = text.trim();
  if (cleanedText.startsWith("```json")) {
    cleanedText = cleanedText.slice(7);
  }
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith("```")) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  try {
    const parsed = JSON.parse(cleanedText) as ContractAnalysisResult;
    return parsed;
  } catch (e) {
    console.error("Failed to parse Gemini response:", cleanedText);
    throw new Error("La IA no pudo extraer datos válidos del contrato. Intenta con otro archivo.");
  }
}
