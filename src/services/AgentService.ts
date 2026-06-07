import { ai } from '../config/clients';
import { ConversationTurn } from '../repositories/ConversationRepository';
import { CANONICAL_CATEGORIES, GEMINI_MODEL, MAX_INPUT_LENGTH } from '../types/constants';
import { withRetry } from '../utils/retry';
import { parseCall, ROUTING_HINTS, TOOL_DECLARATIONS } from './tools';

export type { AgentAction } from './tools';

const SYSTEM_INSTRUCTION =
  `Você é o assistente financeiro do FinAI Bot (pt-BR). Interprete a mensagem e CHAME a ferramenta adequada:\n` +
  `${ROUTING_HINTS}\n` +
  `Se a mensagem não for sobre finanças ou for só uma dúvida de uso, NÃO chame nenhuma ferramenta.\n` +
  `Os parâmetros "incluir_*" são opt-in: só os ative quando o usuário pedir explicitamente o dado extra; o padrão é a resposta enxuta.\n` +
  `Ao registrar gasto/entrada, escolha uma categoria GENÉRICA da lista canônica: [${CANONICAL_CATEGORIES.join(', ')}]. ` +
  `Mapeie semanticamente (ração→Pet, jiu-jitsu→Exercícios, mercado→Alimentação). Use 'Outros' só se nada se aplicar.\n` +
  `Se faltar uma informação obrigatória (ex.: o valor de um gasto em "gastei no mercado"), NÃO invente nem chame a ferramenta — ` +
  `pergunte ao usuário em uma frase curta. Use o histórico da conversa para completar pedidos iniciados antes.`;

export class AgentService {
  async interpret(text: string, history: ConversationTurn[] = []) {
    if (text.length > MAX_INPUT_LENGTH) {
      return { tool: 'none' as const };
    }

    const contents = [
      ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
      { role: 'user', parts: [{ text }] },
    ];

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      })
    );

    const call = response.functionCalls?.[0];
    if (!call?.name) {
      return { tool: 'none' as const, text: response.text };
    }

    return parseCall(call.name, call.args ?? {});
  }
}
