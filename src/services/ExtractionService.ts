import { ai } from '../config/clients';
import { GeminiExtractionSchema, GeminiExtraction } from '../types';

export class ExtractionService {
    /**
   * Extrai dados financeiros de um texto
   * @param text - O texto do qual extrair dados
   * @returns Os dados financeiros extraídos
   */
  async extractFromText(text: string): Promise<GeminiExtraction> {
    const prompt = `Extraia os dados financeiros do seguinte texto: "${text}"`;
    
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: `Você é um extrator de dados JSON. Retorne ESTRITAMENTE um JSON válido seguindo este esquema: ${JSON.stringify(GeminiExtractionSchema.shape)}`
      }
    });

    const rawText = result.text || '{}';
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanJson) as GeminiExtraction;
  }
}