import { ai } from '../config/clients';
import { Classification, ClassificationSchema } from '../types';
import { AppError } from '../types/errors';
import { GEMINI_MODEL, MAX_INPUT_LENGTH } from '../types/constants';

const CONFIDENCE_THRESHOLD = 0.5;

const SYSTEM_INSTRUCTION = `Você é um classificador de mensagens para um bot financeiro pessoal em português brasileiro.
Retorne APENAS um JSON válido com {intent, confidence, slots?}.

Categorias (intent):
- EXPENSE: o usuário descreve um gasto. Ex: "gastei 40 no mercado", "comprei um tênis 200".
- INFLOW: o usuário descreve renda extra/bônus/presente. Ex: "recebi 200 de bônus".
- UPDATE_SALARY: o usuário altera a renda fixa mensal. Ex: "meu salário agora é 4000".
- QUERY_SUMMARY: pede resumo de gastos. Ex: "quanto gastei hoje?", "resumo do mês".
- QUERY_LIST: pede lista detalhada de gastos. Ex: "me mostra meus gastos com lazer".
- DELETE_BY_DESCRIPTION: pede para remover um gasto. Ex: "remove meu último mercado".
- HELP: pergunta sobre o bot ou funcionamento. Ex: "como funciona?", "o que vc faz?".
- GREETING: saudação ou agradecimento curto. Ex: "oi", "obrigado".
- OUT_OF_SCOPE: qualquer assunto não-financeiro. Ex: "qual a capital da França?".

Slots (opcionais):
- period: "today" | "week" | "month" | "last_month" — só para QUERY_*.
- category: string — só para QUERY_LIST quando filtrar por categoria.
- description: string — só para DELETE_BY_DESCRIPTION (texto curto identificando o gasto).

Confidence: número 0–1 indicando sua certeza. Se duvidoso, prefira OUT_OF_SCOPE com confidence baixa.

Exemplos:
"gastei 40 no mercado" → {"intent":"EXPENSE","confidence":0.95}
"meu salário agora é 4500" → {"intent":"UPDATE_SALARY","confidence":0.9}
"quanto gastei essa semana?" → {"intent":"QUERY_SUMMARY","confidence":0.9,"slots":{"period":"week"}}
"me mostra os gastos com lazer no mês" → {"intent":"QUERY_LIST","confidence":0.85,"slots":{"period":"month","category":"lazer"}}
"remove o último mercado" → {"intent":"DELETE_BY_DESCRIPTION","confidence":0.85,"slots":{"description":"mercado"}}
"como você funciona?" → {"intent":"HELP","confidence":0.9}
"oi" → {"intent":"GREETING","confidence":0.95}
"qual a capital da França?" → {"intent":"OUT_OF_SCOPE","confidence":0.95}`;

export class ClassificationService {
  async classify(text: string): Promise<Classification> {
    if (text.length > MAX_INPUT_LENGTH) {
      return { intent: 'OUT_OF_SCOPE', confidence: 0 };
    }

    const sanitized = text.replace(/"/g, "'");

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: sanitized,
      config: {
        responseMimeType: 'application/json',
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    if (!result.text) {
      console.warn('[classify] empty response, falling back to OUT_OF_SCOPE');
      return { intent: 'OUT_OF_SCOPE', confidence: 0 };
    }

    const cleaned = result.text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn('[classify] invalid JSON:', cleaned.slice(0, 100));
      return { intent: 'OUT_OF_SCOPE', confidence: 0 };
    }

    const validation = ClassificationSchema.safeParse(parsed);
    if (!validation.success) {
      console.warn(
        '[classify] schema validation failed:',
        validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      );
      return { intent: 'OUT_OF_SCOPE', confidence: 0 };
    }

    const data = validation.data;
    if (data.confidence < CONFIDENCE_THRESHOLD && data.intent !== 'GREETING') {
      console.info('[classify] low confidence', data);
      return { ...data, intent: 'OUT_OF_SCOPE' };
    }

    console.info('[classify]', { intent: data.intent, confidence: data.confidence });
    return data;
  }
}

export class ClassificationError extends AppError {
  constructor(detail: string) {
    super(`Classification failed: ${detail}`, 'CLASSIFICATION_ERROR', '🤖 Não consegui entender. Tente reescrever.');
  }
}
