import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = "AIzaSyDiEnLT_ocn3_1B-y1eFGfWaP_njAHxxoM";

const genAI = new GoogleGenerativeAI(API_KEY);

export interface ContractAnalysisResult {
  labName: string;
  year: number;
  totalGoal: number;
  funds: Array<{
    concept: string;
    type: 'percentage' | 'fixed';
    value: number;
  }>;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PROMPT = `Actúa como un analista de contratos comerciales. Analiza este PDF adjunto.
Extrae y devuelve UNICAMENTE un objeto JSON (sin markdown \`\`\`json) con esta estructura exacta:
{
  "labName": "Nombre del laboratorio encontrado",
  "year": 2025,
  "totalGoal": 000000,
  "funds": [
    { "concept": "Nombre (ej: Rebate Sell In)", "type": "percentage" o "fixed", "value": 0 }
  ]
}
Si encuentras tablas de bonificaciones, mapealas al array 'funds'. Normaliza los porcentajes (ej: 3% = 3.0).`;

async function tryAnalyzeWithModel(
  modelName: string,
  base64Data: string,
  mimeType: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    { text: PROMPT },
  ]);

  const response = await result.response;
  return response.text();
}

function parseResponse(text: string): ContractAnalysisResult {
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  }
  if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  try {
    return JSON.parse(cleanedText) as ContractAnalysisResult;
  } catch (e) {
    console.error('Failed to parse Gemini response:', cleanedText);
    throw new Error('La IA no pudo extraer datos válidos del contrato. Intenta con otro archivo.');
  }
}

export async function analyzeContract(file: File): Promise<ContractAnalysisResult> {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type || 'application/pdf';

  // Primary model: gemini-2.0-flash-exp (free tier, fast)
  const PRIMARY_MODEL = 'gemini-2.0-flash-exp';
  // Fallback model: gemini-1.5-flash-latest
  const FALLBACK_MODEL = 'gemini-1.5-flash-latest';

  try {
    console.log(`Attempting analysis with ${PRIMARY_MODEL}...`);
    const text = await tryAnalyzeWithModel(PRIMARY_MODEL, base64Data, mimeType);
    return parseResponse(text);
  } catch (primaryError: any) {
    console.error(`Primary model (${PRIMARY_MODEL}) failed:`, primaryError);

    // Check for quota exceeded (429) error
    if (primaryError?.status === 429 || primaryError?.message?.includes('429') || primaryError?.message?.includes('quota')) {
      throw new Error('El sistema está ocupado o ha alcanzado su límite gratuito. Por favor espera un minuto e intenta de nuevo.');
    }

    // Try fallback model
    try {
      console.log(`Falling back to ${FALLBACK_MODEL}...`);
      const text = await tryAnalyzeWithModel(FALLBACK_MODEL, base64Data, mimeType);
      return parseResponse(text);
    } catch (fallbackError: any) {
      console.error(`Fallback model (${FALLBACK_MODEL}) also failed:`, fallbackError);

      // Check for quota exceeded on fallback too
      if (fallbackError?.status === 429 || fallbackError?.message?.includes('429') || fallbackError?.message?.includes('quota')) {
        throw new Error('El sistema está ocupado o ha alcanzado su límite gratuito. Por favor espera un minuto e intenta de nuevo.');
      }

      throw new Error('No se pudo analizar el contrato. Por favor intenta más tarde o con otro archivo.');
    }
  }
}
