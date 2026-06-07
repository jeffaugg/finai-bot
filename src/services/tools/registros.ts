import { Type } from '@google/genai';
import { z } from 'zod';
import { categoryProp, ToolModule } from './types';

const gastoSchema = z.object({ amount: z.number().positive(), category: z.string().min(1) });
const entradaSchema = z.object({ amount: z.number().positive(), category: z.string().min(1) });
const salarioSchema = z.object({ amount: z.number().positive() });

export const registrosTools: ToolModule[] = [
  {
    declaration: {
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
    routingHint: '- gasto/despesa → registrar_gasto',
    parse(args) {
      const p = gastoSchema.safeParse(args);
      return p.success ? { tool: 'registrar_gasto', ...p.data } : null;
    },
  },
  {
    declaration: {
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
    routingHint: '- renda extra/bônus/presente → registrar_entrada',
    parse(args) {
      const p = entradaSchema.safeParse(args);
      return p.success ? { tool: 'registrar_entrada', ...p.data } : null;
    },
  },
  {
    declaration: {
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
    routingHint: '- mudança de salário fixo → atualizar_salario',
    parse(args) {
      const p = salarioSchema.safeParse(args);
      return p.success ? { tool: 'atualizar_salario', ...p.data } : null;
    },
  },
];
