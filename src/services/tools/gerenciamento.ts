import { Type } from '@google/genai';
import { z } from 'zod';
import { CANONICAL_CATEGORIES } from '../../types/constants';
import { ToolModule } from './types';

const removerSchema = z.object({ description: z.string().min(1) });
const corrigirSchema = z.object({
  new_amount: z.number().positive(),
  new_category: z.string().min(1).optional(),
});

export const gerenciamentoTools: ToolModule[] = [
  {
    declaration: {
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
    routingHint: '- pedido para remover/desfazer um gasto → remover_transacao',
    parse(args) {
      const p = removerSchema.safeParse(args);
      return p.success ? { tool: 'remover_transacao', ...p.data } : null;
    },
  },
  {
    declaration: {
      name: 'corrigir_ultimo_gasto',
      description:
        'Corrige o valor (e opcionalmente a categoria) do ÚLTIMO gasto registrado. Use quando o usuário se corrige. ' +
        'Ex: "na verdade foi 50", "corrige o último para 80", "o último era em Lazer".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          new_amount: {
            type: Type.NUMBER,
            description: 'Novo valor do gasto em reais (R$), positivo.',
          },
          new_category: {
            type: Type.STRING,
            enum: [...CANONICAL_CATEGORIES],
            description: 'Nova categoria (opcional). Omita para manter a categoria atual.',
          },
        },
        required: ['new_amount'],
      },
    },
    routingHint: '- correção do valor/categoria do último gasto ("na verdade foi X") → corrigir_ultimo_gasto',
    parse(args) {
      const p = corrigirSchema.safeParse(args);
      return p.success
        ? { tool: 'corrigir_ultimo_gasto', amount: p.data.new_amount, category: p.data.new_category }
        : null;
    },
  },
];
