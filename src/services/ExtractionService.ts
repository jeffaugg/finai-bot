import { ai } from '../config/clients';
import { GeminiExtractionSchema, GeminiExtraction } from '../types';
import { AIExtractionError } from '../types/errors';
import { GEMINI_MODEL, MAX_INPUT_LENGTH } from '../types/constants';

export class ExtractionService {
  async extractFromText(text: string): Promise<GeminiExtraction> {
    if (text.length > MAX_INPUT_LENGTH) {
      throw new AIExtractionError(`Texto muito longo (${text.length} chars)`);
    }

    const sanitized = text.replace(/"/g, "'");
    const prompt = `Extraia os dados financeiros do seguinte texto: "${sanitized}"`;

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: `Você é um extrator de dados JSON. Retorne ESTRITAMENTE um JSON válido seguindo este esquema: ${JSON.stringify(GeminiExtractionSchema.shape)}`,
      },
    });

    if (!result.text) {
      throw new AIExtractionError('Resposta vazia da API Gemini');
    }

    const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      throw new AIExtractionError(`JSON inválido retornado: ${cleanJson.slice(0, 100)}`);
    }

    const validation = GeminiExtractionSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new AIExtractionError(`Schema inválido: ${issues}`);
    }

    return validation.data;
  }
}
