import { Type } from '@google/genai';
import { z } from 'zod';
import { ToolModule } from './types';

const lacunaSchema = z.object({
  intencao: z.string().min(1),
  motivo: z.string().min(1),
  sugestao: z.string().min(1),
});

const lembretesSchema = z.object({ ativar: z.boolean() });

export const sistemaTools: ToolModule[] = [
  {
    declaration: {
      name: 'configurar_lembretes',
      description:
        'Liga ou desliga os lembretes diários do bot. ' +
        'Ex: "para de me lembrar", "desativa as notificações", "pode voltar a me lembrar".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          ativar: {
            type: Type.BOOLEAN,
            description: 'true para ativar os lembretes, false para desativar.',
          },
        },
        required: ['ativar'],
      },
    },
    routingHint: '- ligar/desligar lembretes diários → configurar_lembretes',
    parse(args) {
      const p = lembretesSchema.safeParse(args);
      return p.success ? { tool: 'configurar_lembretes', ...p.data } : null;
    },
  },
  {
    declaration: {
      name: 'reportar_lacuna',
      description:
        'Use SÓ quando o pedido for sobre finanças pessoais MAS você não conseguir atendê-lo com as outras ferramentas — ' +
        'seja porque falta uma ferramenta para essa intenção, seja porque falta uma informação/capacidade. ' +
        'Ex: registrar gasto de uma data passada específica, exportar relatório, definir metas. ' +
        'NÃO use para saudações, off-topic ou dúvidas de uso (esses não chamam ferramenta). ' +
        'Registra a lacuna para evolução do sistema.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          intencao: {
            type: Type.STRING,
            description: 'O que o usuário queria fazer, em uma frase (a intenção percebida).',
          },
          motivo: {
            type: Type.STRING,
            description: 'Por que você não conseguiu atender (ferramenta ausente, dado faltante etc.).',
          },
          sugestao: {
            type: Type.STRING,
            description: 'O que seria necessário: nova ferramenta, novo parâmetro ou novo dado.',
          },
        },
        required: ['intencao', 'motivo', 'sugestao'],
      },
    },
    routingHint:
      '- pedido SOBRE FINANÇAS que nenhuma ferramenta acima atende → reportar_lacuna (não invente nem recuse em texto livre)',
    parse(args) {
      const p = lacunaSchema.safeParse(args);
      return p.success ? { tool: 'reportar_lacuna', ...p.data } : null;
    },
  },
];
