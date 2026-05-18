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

const PLAN_ANALYSIS_MODEL = (import.meta.env.VITE_PLAN_ANALYSIS_MODEL as string | undefined) ?? 'gpt-5.4-mini';
const PLAN_ANALYSIS_SYSTEM_PROMPT = `Actua como un analista de contratos comerciales.

Analiza el PDF adjunto y devuelve un JSON puro, sin markdown, con esta estructura exacta:
{
  "brand_name": "string",
  "year": 2027,
  "annual_goal": 0,
  "invoice_discount_perc": 0,
  "rebate_sell_in_perc": 0,
  "rebate_sell_out_perc": 0,
  "marketing_perc": 0,
  "marketing_fixed_value": 0,
  "financial_discount_perc": 0,
  "total_margin_perc": 0,
  "funds": [
    { "concept_key": "Marketing", "custom_concept": "", "type": "percentage", "value": 0 }
  ]
}

Reglas:
- Usa 0 cuando no encuentres un valor claro.
- annual_goal debe ser numero sin separadores.
- Los porcentajes deben ser numeros normales. Ejemplo: 3% => 3.
- total_margin_perc debe ser la suma de invoice_discount_perc + rebate_sell_in_perc + rebate_sell_out_perc + marketing_perc + financial_discount_perc.
- En funds solo puedes usar estos concept_key: Desc_Pie_Factura, Rebate_SellIn, Rebate_SellOut, Marketing, Pronto_Pago, Otro.
- Si el concepto detectado coincide con uno de los oficiales, usa ese concept_key y deja custom_concept vacio.
- Si el concepto detectado no coincide con la lista oficial, usa concept_key = "Otro" y llena custom_concept con el nombre exacto detectado en el contrato.
- Conserva en funds los conceptos detectados usando type = "percentage" o "fixed".
- Debes leer el contenido del PDF adjunto. No respondas que no puedes analizar PDFs.
- No agregues texto adicional. Responde solo JSON valido.`;

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
    user_input: 'Lee el PDF adjunto, identifica laboratorio, ano, meta, descuentos, rebates, marketing, pronto pago y devuelve exclusivamente el JSON solicitado. Si aparece un concepto fuera del catalogo permitido, envialo como concept_key=Otro con custom_concept.',
    temperature: 0.1,
    max_output_tokens: 1400,
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
