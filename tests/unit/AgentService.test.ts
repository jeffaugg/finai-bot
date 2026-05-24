import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();

vi.mock('../../src/config/clients', () => ({
  ai: { models: { generateContent: (...args: unknown[]) => generateContent(...args) } },
}));

import { AgentService } from '../../src/services/AgentService';

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
    const action = await svc.interpret('gastei 40 no mercado');
    expect(action).toEqual({ tool: 'registrar_gasto', amount: 40, category: 'Alimentação' });
  });

  it('mapeia registrar_entrada', async () => {
    mockCall('registrar_entrada', { amount: 200, category: 'Bônus' });
    const action = await svc.interpret('recebi 200 de bônus');
    expect(action).toEqual({ tool: 'registrar_entrada', amount: 200, category: 'Bônus' });
  });

  it('mapeia atualizar_salario', async () => {
    mockCall('atualizar_salario', { amount: 5000 });
    const action = await svc.interpret('meu salário agora é 5000');
    expect(action).toEqual({ tool: 'atualizar_salario', amount: 5000 });
  });

  it('mapeia consultar_resumo com período', async () => {
    mockCall('consultar_resumo', { period: 'week' });
    const action = await svc.interpret('quanto gastei essa semana?');
    expect(action).toEqual({ tool: 'consultar_resumo', period: 'week' });
  });

  it('mapeia consultar_resumo sem período', async () => {
    mockCall('consultar_resumo', {});
    const action = await svc.interpret('quanto gastei?');
    expect(action).toEqual({ tool: 'consultar_resumo' });
  });

  it('mapeia listar_transacoes com período e categoria', async () => {
    mockCall('listar_transacoes', { period: 'month', category: 'Lazer' });
    const action = await svc.interpret('meus gastos com lazer no mês');
    expect(action).toEqual({ tool: 'listar_transacoes', period: 'month', category: 'Lazer' });
  });

  it('mapeia remover_transacao', async () => {
    mockCall('remover_transacao', { description: 'mercado' });
    const action = await svc.interpret('remove meu último mercado');
    expect(action).toEqual({ tool: 'remover_transacao', description: 'mercado' });
  });

  it('retorna none quando não há function call', async () => {
    generateContent.mockResolvedValue({ functionCalls: undefined });
    const action = await svc.interpret('qual a capital da França?');
    expect(action).toEqual({ tool: 'none' });
  });

  it('retorna none com o texto do modelo (pergunta de follow-up)', async () => {
    generateContent.mockResolvedValue({ functionCalls: undefined, text: 'Quanto você gastou?' });
    const action = await svc.interpret('gastei no mercado');
    expect(action).toEqual({ tool: 'none', text: 'Quanto você gastou?' });
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
    const action = await svc.interpret('gastei -5');
    expect(action).toEqual({ tool: 'none' });
  });

  it('retorna none para ferramenta desconhecida', async () => {
    mockCall('ferramenta_inexistente', {});
    const action = await svc.interpret('algo');
    expect(action).toEqual({ tool: 'none' });
  });

  it('retorna none e não chama a IA quando o texto excede o limite', async () => {
    const action = await svc.interpret('a'.repeat(501));
    expect(action).toEqual({ tool: 'none' });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('envia as tools na config', async () => {
    mockCall('registrar_gasto', { amount: 10, category: 'Outros' });
    await svc.interpret('gastei 10');
    const config = generateContent.mock.calls[0][0].config;
    expect(config.tools[0].functionDeclarations).toHaveLength(7);
  });

  it('mapeia corrigir_ultimo_gasto sem categoria', async () => {
    mockCall('corrigir_ultimo_gasto', { new_amount: 50 });
    const action = await svc.interpret('na verdade foi 50');
    expect(action).toEqual({ tool: 'corrigir_ultimo_gasto', amount: 50 });
  });

  it('mapeia corrigir_ultimo_gasto com nova categoria', async () => {
    mockCall('corrigir_ultimo_gasto', { new_amount: 80, new_category: 'Lazer' });
    const action = await svc.interpret('corrige o último para 80 em lazer');
    expect(action).toEqual({ tool: 'corrigir_ultimo_gasto', amount: 80, category: 'Lazer' });
  });
});
