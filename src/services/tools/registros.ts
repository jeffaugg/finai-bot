import { Type } from '@google/genai';
import { z } from 'zod';
import { categoryProp, ToolModule } from './types';

const gastoSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  dia: z.enum(['hoje', 'ontem']).optional(),
});
const entradaSchema = z.object({ amount: z.number().positive(), category: z.string().min(1) });
const salarioSchema = z.object({ amount: z.number().positive() });
const gastosFixosSchema = z.object({ amount: z.number().min(0) });
const poupancaSchema = z.object({ percent: z.number().min(0).max(90) });

export const registrosTools: ToolModule[] = [
  {
    declaration: {
      name: 'registrar_gasto',
      description:
        'Registra um gasto/despesa (dinheiro que saiu). Use quando o usuário relata algo que comprou ou pagou. ' +
        'Ex: "gastei 40 no mercado", "paguei 30 de uber", "ontem gastei 25 na padaria". ' +
        'Se a frase tiver VÁRIOS gastos com valores próprios, chame a ferramenta uma vez por gasto.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          amount: {
            type: Type.NUMBER,
            description: 'Valor do gasto em reais (R$), absoluto e positivo.',
          },
          category: categoryProp,
          dia: {
            type: Type.STRING,
            enum: ['hoje', 'ontem'],
            description:
              "Quando o gasto aconteceu. Omita para hoje (padrão). Use 'ontem' SÓ se o usuário disser explicitamente que foi ontem. " +
              'Outras datas passadas não são suportadas → reportar_lacuna.',
          },
        },
        required: ['amount', 'category'],
      },
    },
    routingHint: '- gasto/despesa (de hoje ou de ontem) → registrar_gasto',
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
        'não para ganhos avulsos nem para contas fixas (essas vão em atualizar_gastos_fixos). ' +
        'Ex: "meu salário agora é 4000", "fui promovido, ganho 5500".',
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
  {
    declaration: {
      name: 'atualizar_gastos_fixos',
      description:
        'Atualiza o total mensal de gastos fixos/contas fixas do usuário (aluguel, contas, assinaturas) e recalcula o limite diário. ' +
        'Não é um gasto avulso (esse vai em registrar_gasto). Ex: "minhas contas fixas agora são 1200", "meu aluguel subiu, gasto fixo de 1800".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          amount: {
            type: Type.NUMBER,
            description: 'Novo total mensal de gastos fixos em reais (R$), zero ou positivo.',
          },
        },
        required: ['amount'],
      },
    },
    routingHint: '- mudança nos gastos/contas fixas mensais → atualizar_gastos_fixos',
    parse(args) {
      const p = gastosFixosSchema.safeParse(args);
      return p.success ? { tool: 'atualizar_gastos_fixos', ...p.data } : null;
    },
  },
  {
    declaration: {
      name: 'atualizar_percentual_poupanca',
      description:
        'Atualiza o percentual da renda que o usuário quer poupar por mês e recalcula o limite diário. ' +
        'Ex: "quero poupar 30% agora", "diminui minha meta de economia pra 10%".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          percent: {
            type: Type.NUMBER,
            description: 'Novo percentual de poupança, de 0 a 90 (ex.: 20 para 20%).',
          },
        },
        required: ['percent'],
      },
    },
    routingHint: '- mudança na meta/percentual de poupança → atualizar_percentual_poupanca',
    parse(args) {
      const p = poupancaSchema.safeParse(args);
      return p.success ? { tool: 'atualizar_percentual_poupanca', ...p.data } : null;
    },
  },
];
