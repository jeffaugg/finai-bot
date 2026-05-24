import { Type } from '@google/genai';
import { ai } from '../config/clients';
import { GeminiExtractionSchema, GeminiExtraction, IntentEnum } from '../types';
import { AIExtractionError } from '../types/errors';
import { CANONICAL_CATEGORIES, GEMINI_MODEL, MAX_INPUT_LENGTH } from '../types/constants';

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [...IntentEnum.options],
      description:
        "Classifique a intenção: 'EXPENSE' para gastos, 'INFLOW' para ganhos extras/bônus, 'UPDATE_SALARY' para mudança de renda fixa.",
    },
    amount: {
      type: Type.NUMBER,
      description: 'O valor numérico absoluto extraído do texto. Nunca use negativo.',
    },
    category: {
      type: Type.STRING,
      description:
        'Categoria GENÉRICA da transação, escolhida da lista canônica fornecida na instrução do sistema.',
    },
  },
  required: ['intent', 'amount', 'category'],
};

export class ExtractionService {
  async extractFromText(text: string, existingCategories?: string[]): Promise<GeminiExtraction> {
    if (text.length > MAX_INPUT_LENGTH) {
      throw new AIExtractionError(`Texto muito longo (${text.length} chars)`);
    }

    const sanitized = text.replace(/"/g, "'");
    const prompt = `Extraia os dados financeiros do seguinte texto: "${sanitized}"`;

    const categoryGuidance =
      `\n\nREGRA DE CATEGORIA (obrigatória):\n` +
      `Você DEVE escolher uma categoria GENÉRICA da lista canônica abaixo. ` +
      `Mapeie semanticamente, NUNCA use o objeto literal do gasto como categoria.\n` +
      `Lista canônica: [${CANONICAL_CATEGORIES.join(', ')}].\n` +
      `Exemplos de mapeamento:\n` +
      `- "ração para o gato" → "Pet"\n` +
      `- "jiu-jitsu" / "academia" → "Exercícios"\n` +
      `- "mercado" / "almoço" / "ifood" → "Alimentação"\n` +
      `- "uber" / "gasolina" → "Transporte"\n` +
      `- "cinema" / "netflix" / "viagem" → "Lazer"\n` +
      `- "remédio" / "consulta" → "Saúde"\n` +
      `Só use "Outros" se realmente nada se aplicar.` +
      (existingCategories?.length
        ? `\nCategorias já usadas por este usuário (priorize reutilizar): [${existingCategories.join(', ')}].`
        : '');

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
        systemInstruction: `Você é um extrator de dados financeiros.${categoryGuidance}`,
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
