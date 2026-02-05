import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyD-pty5x49v3qIN8rvIOejZZ9KewvDlCrQ";

const PRIMARY_MODEL = "gemini-3.0-flash";
const FALLBACK_MODEL = "gemini-3.0-flash-001";

const genAI = new GoogleGenerativeAI(API_KEY);

export interface ContractAnalysisResult {
  labName: string;
  year: number;
  totalGoal: number;
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

async function tryAnalyzeWithModel(
  modelName: string,
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
    { text: prompt },
  ]);
  const response = await result.response;
  return response.text();
}

export async function analyzeContract(file: File): Promise<ContractAnalysisResult> {
  const base64Data = await fileToBase64(file);

  const prompt = `Actúa como un analista de contratos comerciales. Analiza este PDF adjunto.
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

  let text: string;
  const mimeType = file.type || "application/pdf";

  try {
    console.log(`Intentando análisis con modelo principal: ${PRIMARY_MODEL}`);
    text = await tryAnalyzeWithModel(PRIMARY_MODEL, base64Data, mimeType, prompt);
  } catch (primaryError: any) {
    console.warn(`Error con ${PRIMARY_MODEL}:`, primaryError?.message || primaryError);

    // Check for quota exceeded (429)
    if (primaryError?.message?.includes("429") || primaryError?.status === 429) {
      throw new Error(
        "El sistema está ocupado o ha alcanzado su límite gratuito. Por favor espera un minuto e intenta de nuevo."
      );
    }

    // Try fallback model
    try {
      console.log(`Intentando con modelo de respaldo: ${FALLBACK_MODEL}`);
      text = await tryAnalyzeWithModel(FALLBACK_MODEL, base64Data, mimeType, prompt);
    } catch (fallbackError: any) {
      console.error(`Error con ${FALLBACK_MODEL}:`, fallbackError?.message || fallbackError);

      if (fallbackError?.message?.includes("429") || fallbackError?.status === 429) {
        throw new Error(
          "El sistema está ocupado o ha alcanzado su límite gratuito. Por favor espera un minuto e intenta de nuevo."
        );
      }

      throw new Error(
        "No se pudo conectar con el servicio de IA. Verifica tu conexión o intenta más tarde."
      );
    }
  }

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
