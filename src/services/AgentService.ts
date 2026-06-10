import { Content, FunctionCallingConfigMode, GenerateContentResponse } from '@google/genai';
import { ai } from '../config/clients';
import { ConversationTurn } from '../repositories/ConversationRepository';
import { CANONICAL_CATEGORIES, GEMINI_MODEL, MAX_INPUT_LENGTH } from '../types/constants';
import { withRetry } from '../utils/retry';
import { AgentAction, parseCall, ROUTING_HINTS, TOOL_DECLARATIONS } from './tools';

export type { AgentAction } from './tools';

export const ACTION_CLAIM_PATTERN =
  /\b(registr(ei|ad[oa])|anot(ei|ad[oa])|atualizei|atualizad[oa]|removi|removid[oa]|apaguei|corrigi|corrigid[oa])\b/i;

const MAX_TOOL_CALLS = 5;

const SYSTEM_INSTRUCTION =
  `Você é o assistente financeiro do FinAI Bot (pt-BR). Interprete a mensagem e CHAME a ferramenta adequada:\n` +
  `${ROUTING_HINTS}\n` +
  `Ações e consultas SÓ acontecem quando você CHAMA a ferramenta — sem chamada, nada é executado. ` +
  `NUNCA responda com texto afirmando que registrou/atualizou/removeu/consultou algo.\n` +
  `No histórico, linhas no formato [ferramenta executada: ...] são ferramentas que você já chamou em turnos anteriores.\n` +
  `Se a mensagem não for sobre finanças ou for só uma dúvida de uso, NÃO chame nenhuma ferramenta.\n` +
  `Os parâmetros "incluir_*" são opt-in: só os ative quando o usuário pedir explicitamente o dado extra; o padrão é a resposta enxuta.\n` +
  `Ao registrar gasto/entrada, escolha uma categoria GENÉRICA da lista canônica: [${CANONICAL_CATEGORIES.join(', ')}]. ` +
  `Mapeie semanticamente (ração→Pet, jiu-jitsu→Exercícios, mercado→Alimentação). Use 'Outros' só se nada se aplicar.\n` +
  `Se faltar uma informação obrigatória (ex.: o valor de um gasto em "gastei no mercado"), NÃO invente nem chame a ferramenta — ` +
  `pergunte ao usuário em uma frase curta. Use o histórico da conversa para completar pedidos iniciados antes.`;

export class AgentService {
  async interpret(text: string, history: ConversationTurn[] = []): Promise<AgentAction[]> {
    if (text.length > MAX_INPUT_LENGTH) {
      return [{ tool: 'none' as const }];
    }

    const contents: Content[] = [
      ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
      { role: 'user', parts: [{ text }] },
    ];

    const response = await this.generate(contents);
    let calls = response.functionCalls ?? [];

    if (calls.length === 0) {
      const freeText = response.text;
      if (!freeText || !ACTION_CLAIM_PATTERN.test(freeText)) {
        return [{ tool: 'none' as const, text: freeText }];
      }

      // O modelo alegou ter executado uma ação sem chamar ferramenta: força uma tool call.
      const retry = await this.generate(contents, true);
      calls = retry.functionCalls ?? [];
      if (calls.length === 0) {
        return [{ tool: 'none' as const }];
      }
    }

    const actions = calls
      .slice(0, MAX_TOOL_CALLS)
      .map((call) => (call.name ? parseCall(call.name, call.args ?? {}) : { tool: 'none' as const }));

    const valid = actions.filter((action) => action.tool !== 'none');
    return valid.length > 0 ? valid : [{ tool: 'none' as const }];
  }

  private generate(contents: Content[], forceToolCall = false): Promise<GenerateContentResponse> {
    return withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          systemInstruction: SYSTEM_INSTRUCTION,
          ...(forceToolCall
            ? { toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } } }
            : {}),
        },
      })
    );
  }
}
