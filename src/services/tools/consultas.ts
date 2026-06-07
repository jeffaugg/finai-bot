import { Type } from '@google/genai';
import { z } from 'zod';
import { ClassificationPeriod } from '../../types';
import { periodProp, sideloadProp, ToolModule } from './types';

const resumoSchema = z.object({
  period: ClassificationPeriod.optional(),
  incluir_transacoes: z.boolean().optional(),
  incluir_comparacao: z.boolean().optional(),
});
const listarSchema = z.object({
  period: ClassificationPeriod.optional(),
  category: z.string().min(1).optional(),
});
const progressoSchema = z.object({ incluir_limite_hoje: z.boolean().optional() });
const saldoSchema = z.object({ incluir_breakdown: z.boolean().optional() });

export const consultasTools: ToolModule[] = [
  {
    declaration: {
      name: 'consultar_resumo',
      description:
        'Retorna o total de gastos do período agrupado por categoria. Use para perguntas de "quanto gastei". ' +
        'Ex: "quanto gastei hoje?", "quanto gastei ontem?", "resumo do mês".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          period: periodProp('hoje'),
          incluir_transacoes: sideloadProp(
            'Anexa a lista das transações individuais além do total por categoria (+1 consulta). ' +
              'Ative só quando o usuário pedir o detalhamento ("com as transações", "lista os gastos").'
          ),
          incluir_comparacao: sideloadProp(
            'Acrescenta a variação vs o período anterior comparável (+1 consulta). ' +
              'Ative só quando o usuário pedir comparação ("comparado com", "gastei mais que").'
          ),
        },
        required: [],
      },
    },
    routingHint: '- pergunta de resumo ("quanto gastei") → consultar_resumo',
    parse(args) {
      const p = resumoSchema.safeParse(args);
      if (!p.success) return null;
      return {
        tool: 'consultar_resumo',
        period: p.data.period,
        incluirTransacoes: p.data.incluir_transacoes,
        incluirComparacao: p.data.incluir_comparacao,
      };
    },
  },
  {
    declaration: {
      name: 'listar_transacoes',
      description:
        'Lista as transações individuais (data, categoria e valor), opcionalmente filtradas por categoria. ' +
        'Use quando o usuário quer ver os gastos detalhados, não só o total. Ex: "meus gastos com lazer", "o que gastei essa semana".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          period: periodProp('mês atual'),
          category: {
            type: Type.STRING,
            description: 'Filtra por categoria. Omita para listar todas as categorias.',
          },
        },
        required: [],
      },
    },
    routingHint: '- pedido de lista detalhada → listar_transacoes',
    parse(args) {
      const p = listarSchema.safeParse(args);
      return p.success
        ? { tool: 'listar_transacoes', period: p.data.period, category: p.data.category }
        : null;
    },
  },
  {
    declaration: {
      name: 'consultar_limite_diario',
      description:
        'Informa quanto o usuário ainda pode gastar hoje (limite diário menos o que já gastou). ' +
        'Use para "quanto posso gastar hoje?", "quanto resta do meu limite?", "ainda posso gastar quanto?".',
      parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    routingHint: '- "quanto posso gastar hoje / quanto resta do limite" → consultar_limite_diario',
    parse() {
      return { tool: 'consultar_limite_diario' };
    },
  },
  {
    declaration: {
      name: 'consultar_progresso',
      description:
        'Mostra o progresso de gamificação: sequência (streak), reserva de sucesso e limite diário. ' +
        'Use para "como tá minha sequência?", "qual minha reserva?", "meu progresso", "meu status".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          incluir_limite_hoje: sideloadProp(
            'Acrescenta quanto ainda dá pra gastar hoje ao status (+1 consulta). ' +
              'Ative só quando o usuário também perguntar do limite/orçamento do dia.'
          ),
        },
        required: [],
      },
    },
    routingHint: '- progresso/sequência/reserva/status → consultar_progresso',
    parse(args) {
      const p = progressoSchema.safeParse(args);
      return p.success
        ? { tool: 'consultar_progresso', incluirLimiteHoje: p.data.incluir_limite_hoje }
        : null;
    },
  },
  {
    declaration: {
      name: 'consultar_saldo_mensal',
      description:
        'Calcula o saldo do mês (entradas menos gastos) — quanto "sobrou". ' +
        'Use para "quanto sobrou esse mês?", "meu saldo do mês", "tô no positivo ou negativo?".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          incluir_breakdown: sideloadProp(
            'Acrescenta a quebra dos gastos por categoria ao saldo (+1 consulta). ' +
              'Ative só quando o usuário pedir o detalhamento por categoria.'
          ),
        },
        required: [],
      },
    },
    routingHint: '- saldo do mês / quanto sobrou → consultar_saldo_mensal',
    parse(args) {
      const p = saldoSchema.safeParse(args);
      return p.success
        ? { tool: 'consultar_saldo_mensal', incluirBreakdown: p.data.incluir_breakdown }
        : null;
    },
  },
];
