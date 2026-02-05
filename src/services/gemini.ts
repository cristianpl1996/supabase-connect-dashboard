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

export async function analyzeContract(file: File): Promise<ContractAnalysisResult> {
  // 2026: Using gemini-2.5-pro for complex reasoning, fallback to gemini-2.0-flash
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

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

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: file.type || 'application/pdf',
        data: base64Data,
      },
    },
    { text: prompt },
  ]);

  const response = await result.response;
  const text = response.text();

  // Clean potential markdown wrapping
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
    const parsed = JSON.parse(cleanedText) as ContractAnalysisResult;
    return parsed;
  } catch (e) {
    console.error('Failed to parse Gemini response:', cleanedText);
    throw new Error('La IA no pudo extraer datos válidos del contrato. Intenta con otro archivo.');
  }
}
