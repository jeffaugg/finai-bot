import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();

vi.mock('../../src/config/clients', () => ({
  ai: { models: { generateContent: (...args: unknown[]) => generateContent(...args) } },
}));

import { ExtractionService } from '../../src/services/ExtractionService';
import { AIExtractionError } from '../../src/types/errors';

const svc = new ExtractionService();

beforeEach(() => {
  generateContent.mockReset();
});

function mockResponse(payload: unknown | string) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  generateContent.mockResolvedValue({ text });
}

describe('ExtractionService.extractFromText', () => {
  it('extrai um gasto válido', async () => {
    mockResponse({ intent: 'EXPENSE', amount: 40, category: 'Alimentação' });

    const result = await svc.extractFromText('gastei 40 no mercado');

    expect(result.intent).toBe('EXPENSE');
    expect(result.amount).toBe(40);
    expect(result.category).toBe('Alimentação');
  });

  it('envia responseSchema e responseMimeType na config', async () => {
    mockResponse({ intent: 'EXPENSE', amount: 40, category: 'Alimentação' });

    await svc.extractFromText('gastei 40 no mercado');

    const config = generateContent.mock.calls[0][0].config;
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseSchema.required).toEqual(['intent', 'amount', 'category']);
  });

  it('inclui as categorias existentes na instrução do sistema', async () => {
    mockResponse({ intent: 'EXPENSE', amount: 40, category: 'Pet' });

    await svc.extractFromText('gastei 40 com ração', ['Pet', 'Lazer']);

    const config = generateContent.mock.calls[0][0].config;
    expect(config.systemInstruction).toContain('Pet');
  });

  it('remove cercas de markdown antes do parse', async () => {
    mockResponse('```json\n{"intent":"INFLOW","amount":200,"category":"Bônus"}\n```');

    const result = await svc.extractFromText('recebi 200 de bônus');

    expect(result.intent).toBe('INFLOW');
    expect(result.amount).toBe(200);
  });

  it('rejeita texto muito longo sem chamar a IA', async () => {
    await expect(svc.extractFromText('a'.repeat(501))).rejects.toBeInstanceOf(AIExtractionError);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('lança AIExtractionError em resposta vazia', async () => {
    mockResponse('');

    await expect(svc.extractFromText('gastei 40')).rejects.toBeInstanceOf(AIExtractionError);
  });

  it('lança AIExtractionError em JSON inválido', async () => {
    mockResponse('isso não é json');

    await expect(svc.extractFromText('gastei 40')).rejects.toBeInstanceOf(AIExtractionError);
  });

  it('lança AIExtractionError quando o valor viola a invariante de negócio (Zod)', async () => {
    mockResponse({ intent: 'EXPENSE', amount: -5, category: 'Alimentação' });

    await expect(svc.extractFromText('gastei -5')).rejects.toBeInstanceOf(AIExtractionError);
  });
});
