import { Type, FunctionDeclaration, Schema } from '@google/genai';
import { z } from 'zod';
import { ai } from '../config/clients';
import { ConversationTurn } from '../repositories/ConversationRepository';
import { ClassificationPeriod } from '../types';
import { CANONICAL_CATEGORIES, GEMINI_MODEL, MAX_INPUT_LENGTH } from '../types/constants';

export type AgentAction =
  | { tool: 'registrar_gasto'; amount: number; category: string }
  | { tool: 'registrar_entrada'; amount: number; category: string }
  | { tool: 'atualizar_salario'; amount: number }
  | { tool: 'consultar_resumo'; period?: ClassificationPeriod }
  | { tool: 'listar_transacoes'; period?: ClassificationPeriod; category?: string }
  | { tool: 'remover_transacao'; description: string }
  | { tool: 'none'; text?: string };

const argSchemas = {
  registrar_gasto: z.object({ amount: z.number().positive(), category: z.string().min(1) }),
  registrar_entrada: z.object({ amount: z.number().positive(), category: z.string().min(1) }),
  atualizar_salario: z.object({ amount: z.number().positive() }),
  consultar_resumo: z.object({ period: ClassificationPeriod.optional() }),
  listar_transacoes: z.object({
    period: ClassificationPeriod.optional(),
    category: z.string().min(1).optional(),
  }),
  remover_transacao: z.object({ description: z.string().min(1) }),
};

const categoryProp: Schema = {
  type: Type.STRING,
  enum: [...CANONICAL_CATEGORIES],
  description:
    "Categoria GENÉRICA da lista canônica, mapeada semanticamente (ração→Pet, jiu-jitsu→Exercícios, mercado→Alimentação). Use 'Outros' só se nada se aplicar.",
};

const TOOLS: FunctionDeclaration[] = [
  {
    name: 'registrar_gasto',
    description:
      'Registra um gasto/despesa (dinheiro que saiu). Use quando o usuário relata algo que comprou ou pagou. ' +
      'Ex: "gastei 40 no mercado", "paguei 30 de uber", "comprei um tênis por 200".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: {
          type: Type.NUMBER,
          description: 'Valor do gasto em reais (R$), absoluto e positivo.',
        },
        category: categoryProp,
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'registrar_entrada',
    description:
      'Registra uma renda extra/ganho/bônus/presente — dinheiro que entrou fora do salário fixo. ' +
      'Ex: "recebi 200 de bônus", "ganhei 50 de presente". Para mudança de salário recorrente use atualizar_salario.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: {
          type: Type.NUMBER,
          description: 'Valor recebido em reais (R$), absoluto e positivo.',
        },
        category: categoryProp,
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'atualizar_salario',
    description:
      'Atualiza a renda fixa mensal do usuário (recalcula o limite diário). Use só para o salário recorrente, ' +
      'não para ganhos avulsos. Ex: "meu salário agora é 4000", "fui promovido, ganho 5500".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: {
          type: Type.NUMBER,
          description: 'Novo salário líquido mensal em reais (R$), positivo.',
        },
      },
      required: ['amount'],
    },
  },
  {
    name: 'consultar_resumo',
    description:
      'Retorna o total de gastos do período agrupado por categoria. Use para perguntas de "quanto gastei". ' +
      'Ex: "quanto gastei hoje?", "resumo do mês".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          enum: [...ClassificationPeriod.options],
          description: 'Período do resumo. Omita para o padrão (hoje).',
        },
      },
      required: [],
    },
  },
  {
    name: 'listar_transacoes',
    description:
      'Lista as transações individuais (data, categoria e valor), opcionalmente filtradas por categoria. ' +
      'Use quando o usuário quer ver os gastos detalhados, não só o total. Ex: "meus gastos com lazer", "o que gastei essa semana".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          enum: [...ClassificationPeriod.options],
          description: 'Período da lista. Omita para o padrão (mês atual).',
        },
        category: {
          type: Type.STRING,
          description: 'Filtra por categoria. Omita para listar todas as categorias.',
        },
      },
      required: [],
    },
  },
  {
    name: 'remover_transacao',
    description:
      'Remove/desfaz um gasto já registrado, identificado por uma descrição curta. ' +
      'Ex: "remove meu último mercado", "apaga o gasto do uber".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        description: {
          type: Type.STRING,
          description: 'Texto curto que identifica o gasto a remover (ex: "mercado", "uber").',
        },
      },
      required: ['description'],
    },
  },
];

const SYSTEM_INSTRUCTION =
  `Você é o assistente financeiro do FinAI Bot (pt-BR). Interprete a mensagem e CHAME a ferramenta adequada:\n` +
  `- gasto/despesa → registrar_gasto\n` +
  `- renda extra/bônus/presente → registrar_entrada\n` +
  `- mudança de salário fixo → atualizar_salario\n` +
  `- pergunta de resumo ("quanto gastei") → consultar_resumo\n` +
  `- pedido de lista detalhada → listar_transacoes\n` +
  `- pedido para remover/desfazer um gasto → remover_transacao\n` +
  `Se a mensagem não for sobre finanças ou for só uma dúvida de uso, NÃO chame nenhuma ferramenta.\n` +
  `Ao registrar gasto/entrada, escolha uma categoria GENÉRICA da lista canônica: [${CANONICAL_CATEGORIES.join(', ')}]. ` +
  `Mapeie semanticamente (ração→Pet, jiu-jitsu→Exercícios, mercado→Alimentação). Use 'Outros' só se nada se aplicar.\n` +
  `Se faltar uma informação obrigatória (ex.: o valor de um gasto em "gastei no mercado"), NÃO invente nem chame a ferramenta — ` +
  `pergunte ao usuário em uma frase curta. Use o histórico da conversa para completar pedidos iniciados antes.`;

export class AgentService {
  async interpret(text: string, history: ConversationTurn[] = []): Promise<AgentAction> {
    if (text.length > MAX_INPUT_LENGTH) {
      return { tool: 'none' };
    }

    const contents = [
      ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.content }] })),
      { role: 'user', parts: [{ text }] },
    ];

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        tools: [{ functionDeclarations: TOOLS }],
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const call = response.functionCalls?.[0];
    if (!call?.name) {
      return { tool: 'none', text: response.text };
    }

    return parseCall(call.name, call.args ?? {});
  }
}

function parseCall(name: string, args: Record<string, unknown>): AgentAction {
  switch (name) {
    case 'registrar_gasto': {
      const p = argSchemas.registrar_gasto.safeParse(args);
      return p.success ? { tool: 'registrar_gasto', ...p.data } : { tool: 'none' };
    }
    case 'registrar_entrada': {
      const p = argSchemas.registrar_entrada.safeParse(args);
      return p.success ? { tool: 'registrar_entrada', ...p.data } : { tool: 'none' };
    }
    case 'atualizar_salario': {
      const p = argSchemas.atualizar_salario.safeParse(args);
      return p.success ? { tool: 'atualizar_salario', ...p.data } : { tool: 'none' };
    }
    case 'consultar_resumo': {
      const p = argSchemas.consultar_resumo.safeParse(args);
      return p.success ? { tool: 'consultar_resumo', ...p.data } : { tool: 'none' };
    }
    case 'listar_transacoes': {
      const p = argSchemas.listar_transacoes.safeParse(args);
      return p.success ? { tool: 'listar_transacoes', ...p.data } : { tool: 'none' };
    }
    case 'remover_transacao': {
      const p = argSchemas.remover_transacao.safeParse(args);
      return p.success ? { tool: 'remover_transacao', ...p.data } : { tool: 'none' };
    }
    default:
      return { tool: 'none' };
  }
}
