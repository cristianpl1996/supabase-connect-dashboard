import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyDiEnLT_ocn3_1B-y1eFGfWaP_njAHxxoM";

const genAI = new GoogleGenerativeAI(API_KEY);

export interface ContractAnalysisResult {
  labName: string;
  year: number;
  totalGoal: number;
  invoice_discount_perc: number;
  rebate_sell_in_perc: number;
  rebate_sell_out_perc: number;
  marketing_perc: number;
  financial_discount_perc: number;
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

REGLAS DE NORMALIZACIÓN DEL NOMBRE:
- Al extraer el campo 'labName', elimina sufijos legales como 'S.A.', 'S.A.S', 'Ltda', 'Inc', 'Colombia', 'México', 'de C.V.', etc.
- Deja solo el NOMBRE COMERCIAL principal.
- Ejemplo: Si dice 'Zoetis Colombia S.A.S', extrae solo 'Zoetis'.
- Ejemplo: Si dice 'Boehringer Ingelheim S.A.', extrae solo 'Boehringer Ingelheim'.
- Ejemplo: Si dice 'Laboratorios MSD de México S.A. de C.V.', extrae solo 'MSD'.

DICCIONARIO DE CLASIFICACIÓN DE PORCENTAJES:
Clasifica cada porcentaje encontrado en el campo correcto:

1. invoice_discount_perc (Pie de Factura): 
   - 'Descuento Base', 'Descuento Comercial', 'Off Invoice', 'Descuento Permanente', 'Descuento en Factura'

2. rebate_sell_in_perc (Rebate Compra): 
   - 'Rappel', 'Bonificación por Volumen', 'Cumplimiento de Meta', 'Nota Crédito Anual', 'Quarterly Rebate', 'Rebate Sell-In'

3. rebate_sell_out_perc (Rebate Venta/Evacuación): 
   - 'Sell-out', 'Evacuación', 'Rotación', 'Transferencia', 'Descuento al Farmacéutico', 'Rebate Sell-Out'

4. marketing_perc (Mercadeo): 
   - 'Cooperativa', 'Visibilidad', 'Plan de Medios', 'Eventos', 'Apoyo Comercial', 'Marketing', 'Publicidad'

5. financial_discount_perc (Financiero): 
   - 'Pronto Pago', 'Descuento Financiero', 'Descuento por Pago Anticipado'

Si un concepto no encaja exactamente, usa tu mejor criterio: si es beneficio por COMPRAR → rebate_sell_in_perc, si es por VENDER → rebate_sell_out_perc.

Extrae y devuelve UNICAMENTE un objeto JSON (sin markdown) con esta estructura exacta:
{
  "labName": "Nombre comercial limpio del laboratorio",
  "year": 2025,
  "totalGoal": 000000,
  "invoice_discount_perc": 0,
  "rebate_sell_in_perc": 0,
  "rebate_sell_out_perc": 0,
  "marketing_perc": 0,
  "financial_discount_perc": 0,
  "funds": [
    { "concept": "Nombre original encontrado", "type": "percentage" o "fixed", "value": 0 }
  ]
}

IMPORTANTE: 
- Normaliza los porcentajes (ej: 3% = 3.0).
- El array 'funds' debe contener TODOS los conceptos encontrados con sus valores originales.
- Los campos *_perc deben tener la suma de porcentajes correspondientes a cada categoría.`;

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
