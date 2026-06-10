import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();

vi.mock('../../src/config/clients', () => ({
  ai: { models: { generateContent: (...args: unknown[]) => generateContent(...args) } },
}));

import { ACTION_CLAIM_PATTERN, AgentService } from '../../src/services/AgentService';

const svc = new AgentService();

beforeEach(() => {
  generateContent.mockReset();
});

function mockCall(name: string, args: Record<string, unknown>) {
  generateContent.mockResolvedValue({ functionCalls: [{ name, args }] });
}

describe('AgentService.interpret', () => {
  it('mapeia registrar_gasto', async () => {
    mockCall('registrar_gasto', { amount: 40, category: 'Alimentação' });
    const actions = await svc.interpret('gastei 40 no mercado');
    expect(actions).toEqual([{ tool: 'registrar_gasto', amount: 40, category: 'Alimentação' }]);
  });

  it('mapeia registrar_gasto com dia "ontem"', async () => {
    mockCall('registrar_gasto', { amount: 25, category: 'Alimentação', dia: 'ontem' });
    const actions = await svc.interpret('ontem gastei 25 na padaria');
    expect(actions).toEqual([
      { tool: 'registrar_gasto', amount: 25, category: 'Alimentação', dia: 'ontem' },
    ]);
  });

  it('retorna none para dia fora do enum', async () => {
    mockCall('registrar_gasto', { amount: 25, category: 'Alimentação', dia: 'anteontem' });
    const actions = await svc.interpret('anteontem gastei 25');
    expect(actions).toEqual([{ tool: 'none' }]);
  });

  it('mapeia registrar_entrada', async () => {
    mockCall('registrar_entrada', { amount: 200, category: 'Bônus' });
    const actions = await svc.interpret('recebi 200 de bônus');
    expect(actions).toEqual([{ tool: 'registrar_entrada', amount: 200, category: 'Bônus' }]);
  });

  it('mapeia atualizar_salario', async () => {
    mockCall('atualizar_salario', { amount: 5000 });
    const actions = await svc.interpret('meu salário agora é 5000');
    expect(actions).toEqual([{ tool: 'atualizar_salario', amount: 5000 }]);
  });

  it('mapeia atualizar_gastos_fixos', async () => {
    mockCall('atualizar_gastos_fixos', { amount: 1200 });
    const actions = await svc.interpret('minhas contas fixas agora são 1200');
    expect(actions).toEqual([{ tool: 'atualizar_gastos_fixos', amount: 1200 }]);
  });

  it('mapeia atualizar_percentual_poupanca', async () => {
    mockCall('atualizar_percentual_poupanca', { percent: 30 });
    const actions = await svc.interpret('quero poupar 30%');
    expect(actions).toEqual([{ tool: 'atualizar_percentual_poupanca', percent: 30 }]);
  });

  it('retorna none para percentual de poupança acima do teto', async () => {
    mockCall('atualizar_percentual_poupanca', { percent: 95 });
    const actions = await svc.interpret('quero poupar 95%');
    expect(actions).toEqual([{ tool: 'none' }]);
  });

  it('mapeia configurar_lembretes', async () => {
    mockCall('configurar_lembretes', { ativar: false });
    const actions = await svc.interpret('para de me lembrar');
    expect(actions).toEqual([{ tool: 'configurar_lembretes', ativar: false }]);
  });

  it('mapeia consultar_resumo com período', async () => {
    mockCall('consultar_resumo', { period: 'week' });
    const actions = await svc.interpret('quanto gastei essa semana?');
    expect(actions).toEqual([{ tool: 'consultar_resumo', period: 'week' }]);
  });

  it('mapeia consultar_resumo sem período', async () => {
    mockCall('consultar_resumo', {});
    const actions = await svc.interpret('quanto gastei?');
    expect(actions).toEqual([{ tool: 'consultar_resumo' }]);
  });

  it('mapeia listar_transacoes com período e categoria', async () => {
    mockCall('listar_transacoes', { period: 'month', category: 'Lazer' });
    const actions = await svc.interpret('meus gastos com lazer no mês');
    expect(actions).toEqual([{ tool: 'listar_transacoes', period: 'month', category: 'Lazer' }]);
  });

  it('mapeia remover_transacao', async () => {
    mockCall('remover_transacao', { description: 'mercado' });
    const actions = await svc.interpret('remove meu último mercado');
    expect(actions).toEqual([{ tool: 'remover_transacao', description: 'mercado' }]);
  });

  it('mapeia múltiplas function calls em sequência', async () => {
    generateContent.mockResolvedValue({
      functionCalls: [
        { name: 'registrar_gasto', args: { amount: 20, category: 'Transporte' } },
        { name: 'registrar_gasto', args: { amount: 30, category: 'Alimentação' } },
      ],
    });
    const actions = await svc.interpret('gastei 20 no uber e 30 no mercado');
    expect(actions).toEqual([
      { tool: 'registrar_gasto', amount: 20, category: 'Transporte' },
      { tool: 'registrar_gasto', amount: 30, category: 'Alimentação' },
    ]);
  });

  it('descarta calls inválidas quando há pelo menos uma válida', async () => {
    generateContent.mockResolvedValue({
      functionCalls: [
        { name: 'registrar_gasto', args: { amount: 20, category: 'Transporte' } },
        { name: 'ferramenta_inexistente', args: {} },
      ],
    });
    const actions = await svc.interpret('gastei 20 no uber e sei lá');
    expect(actions).toEqual([{ tool: 'registrar_gasto', amount: 20, category: 'Transporte' }]);
  });

  it('limita a 5 function calls', async () => {
    generateContent.mockResolvedValue({
      functionCalls: Array.from({ length: 8 }, (_, i) => ({
        name: 'registrar_gasto',
        args: { amount: i + 1, category: 'Outros' },
      })),
    });
    const actions = await svc.interpret('vários gastos');
    expect(actions).toHaveLength(5);
  });

  it('retorna none quando não há function call', async () => {
    generateContent.mockResolvedValue({ functionCalls: undefined });
    const actions = await svc.interpret('qual a capital da França?');
    expect(actions).toEqual([{ tool: 'none', text: undefined }]);
  });

  it('retorna none com o texto do modelo (pergunta de follow-up)', async () => {
    generateContent.mockResolvedValue({ functionCalls: undefined, text: 'Quanto você gastou?' });
    const actions = await svc.interpret('gastei no mercado');
    expect(actions).toEqual([{ tool: 'none', text: 'Quanto você gastou?' }]);
  });

  it('inclui o histórico no contents enviado ao modelo', async () => {
    mockCall('registrar_gasto', { amount: 40, category: 'Alimentação' });
    const history = [
      { role: 'user' as const, content: 'gastei no mercado' },
      { role: 'model' as const, content: 'Quanto você gastou?' },
    ];

    await svc.interpret('40', history);

    const contents = generateContent.mock.calls[0][0].contents;
    expect(contents).toHaveLength(3);
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'gastei no mercado' }] });
    expect(contents[2]).toEqual({ role: 'user', parts: [{ text: '40' }] });
  });

  it('retorna none quando os args violam a invariante de negócio (Zod)', async () => {
    mockCall('registrar_gasto', { amount: -5, category: 'Alimentação' });
    const actions = await svc.interpret('gastei -5');
    expect(actions).toEqual([{ tool: 'none' }]);
  });

  it('retorna none para ferramenta desconhecida', async () => {
    mockCall('ferramenta_inexistente', {});
    const actions = await svc.interpret('algo');
    expect(actions).toEqual([{ tool: 'none' }]);
  });

  it('retorna none e não chama a IA quando o texto excede o limite', async () => {
    const actions = await svc.interpret('a'.repeat(501));
    expect(actions).toEqual([{ tool: 'none' }]);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('envia as tools na config', async () => {
    mockCall('registrar_gasto', { amount: 10, category: 'Outros' });
    await svc.interpret('gastei 10');
    const config = generateContent.mock.calls[0][0].config;
    expect(config.tools[0].functionDeclarations).toHaveLength(14);
  });

  it('mapeia corrigir_ultimo_gasto sem categoria', async () => {
    mockCall('corrigir_ultimo_gasto', { new_amount: 50 });
    const actions = await svc.interpret('na verdade foi 50');
    expect(actions).toEqual([{ tool: 'corrigir_ultimo_gasto', amount: 50 }]);
  });

  it('mapeia corrigir_ultimo_gasto com nova categoria', async () => {
    mockCall('corrigir_ultimo_gasto', { new_amount: 80, new_category: 'Lazer' });
    const actions = await svc.interpret('corrige o último para 80 em lazer');
    expect(actions).toEqual([{ tool: 'corrigir_ultimo_gasto', amount: 80, category: 'Lazer' }]);
  });

  it('mapeia consultar_resumo com período "ontem"', async () => {
    mockCall('consultar_resumo', { period: 'yesterday' });
    const actions = await svc.interpret('quanto gastei ontem?');
    expect(actions).toEqual([
      {
        tool: 'consultar_resumo',
        period: 'yesterday',
        incluirTransacoes: undefined,
        incluirComparacao: undefined,
      },
    ]);
  });

  it('mapeia os sideloads de consultar_resumo', async () => {
    mockCall('consultar_resumo', {
      period: 'month',
      incluir_transacoes: true,
      incluir_comparacao: true,
    });
    const actions = await svc.interpret('resumo do mês com as transações comparado');
    expect(actions).toEqual([
      {
        tool: 'consultar_resumo',
        period: 'month',
        incluirTransacoes: true,
        incluirComparacao: true,
      },
    ]);
  });

  it('mapeia consultar_limite_diario', async () => {
    mockCall('consultar_limite_diario', {});
    const actions = await svc.interpret('quanto posso gastar hoje?');
    expect(actions).toEqual([{ tool: 'consultar_limite_diario' }]);
  });

  it('mapeia consultar_progresso com sideload', async () => {
    mockCall('consultar_progresso', { incluir_limite_hoje: true });
    const actions = await svc.interpret('como tá minha sequência e meu limite?');
    expect(actions).toEqual([{ tool: 'consultar_progresso', incluirLimiteHoje: true }]);
  });

  it('mapeia consultar_saldo_mensal', async () => {
    mockCall('consultar_saldo_mensal', { incluir_breakdown: true });
    const actions = await svc.interpret('quanto sobrou esse mês por categoria?');
    expect(actions).toEqual([{ tool: 'consultar_saldo_mensal', incluirBreakdown: true }]);
  });

  it('mapeia reportar_lacuna', async () => {
    mockCall('reportar_lacuna', {
      intencao: 'registrar investimento',
      motivo: 'sem ferramenta de investimento',
      sugestao: 'criar registrar_investimento',
    });
    const actions = await svc.interpret('investi 3000');
    expect(actions).toEqual([
      {
        tool: 'reportar_lacuna',
        intencao: 'registrar investimento',
        motivo: 'sem ferramenta de investimento',
        sugestao: 'criar registrar_investimento',
      },
    ]);
  });

  it('retorna none quando reportar_lacuna vem incompleta (Zod)', async () => {
    mockCall('reportar_lacuna', { intencao: 'algo' });
    const actions = await svc.interpret('algo financeiro complexo');
    expect(actions).toEqual([{ tool: 'none' }]);
  });
});

describe('AgentService — guardrail anti-alucinação', () => {
  it('detecta alegações de ação no texto livre', () => {
    expect(ACTION_CLAIM_PATTERN.test('Registrei um gasto de R$ 32.00 em Alimentação.')).toBe(true);
    expect(ACTION_CLAIM_PATTERN.test('Pronto, gasto registrado!')).toBe(true);
    expect(ACTION_CLAIM_PATTERN.test('Atualizei o salário para R$ 5000.00.')).toBe(true);
    expect(ACTION_CLAIM_PATTERN.test('Anotei seu gasto.')).toBe(true);
    expect(ACTION_CLAIM_PATTERN.test('Quanto você gastou?')).toBe(false);
    expect(ACTION_CLAIM_PATTERN.test('Posso te ajudar com gastos e resumos.')).toBe(false);
  });

  it('refaz a chamada forçando tool quando o modelo alega ação sem function call', async () => {
    generateContent
      .mockResolvedValueOnce({
        functionCalls: undefined,
        text: 'Registrei um gasto de R$ 32.00 em Alimentação.',
      })
      .mockResolvedValueOnce({
        functionCalls: [{ name: 'registrar_gasto', args: { amount: 32, category: 'Alimentação' } }],
      });

    const actions = await svc.interpret('gastei 32 com bolo e salgado');

    expect(actions).toEqual([{ tool: 'registrar_gasto', amount: 32, category: 'Alimentação' }]);
    expect(generateContent).toHaveBeenCalledTimes(2);
    const retryConfig = generateContent.mock.calls[1][0].config;
    expect(retryConfig.toolConfig.functionCallingConfig.mode).toBe('ANY');
  });

  it('nunca repassa a confirmação alucinada se o retry também falhar', async () => {
    generateContent
      .mockResolvedValueOnce({
        functionCalls: undefined,
        text: 'Registrei um gasto de R$ 32.00 em Alimentação.',
      })
      .mockResolvedValueOnce({ functionCalls: undefined, text: 'Registrei de novo.' });

    const actions = await svc.interpret('gastei 32 com bolo e salgado');

    expect(actions).toEqual([{ tool: 'none' }]);
  });

  it('não refaz a chamada para texto livre inofensivo', async () => {
    generateContent.mockResolvedValue({ functionCalls: undefined, text: 'Quanto você gastou?' });

    await svc.interpret('gastei no mercado');

    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
