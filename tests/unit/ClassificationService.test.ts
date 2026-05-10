import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();

vi.mock('../../src/config/clients', () => ({
  ai: { models: { generateContent: (...args: unknown[]) => generateContent(...args) } },
}));

import { ClassificationService } from '../../src/services/ClassificationService';

const svc = new ClassificationService();

beforeEach(() => {
  generateContent.mockReset();
});

function mockResponse(payload: unknown | string) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  generateContent.mockResolvedValue({ text });
}

describe('ClassificationService.classify', () => {
  it('parses a valid EXPENSE response', async () => {
    mockResponse({ intent: 'EXPENSE', confidence: 0.95 });
    const result = await svc.classify('gastei 40 no mercado');
    expect(result.intent).toBe('EXPENSE');
    expect(result.confidence).toBeCloseTo(0.95);
  });

  it('parses slots for QUERY_SUMMARY', async () => {
    mockResponse({ intent: 'QUERY_SUMMARY', confidence: 0.9, slots: { period: 'week' } });
    const result = await svc.classify('quanto gastei essa semana?');
    expect(result.intent).toBe('QUERY_SUMMARY');
    expect(result.slots?.period).toBe('week');
  });

  it('strips ```json fences before parsing', async () => {
    mockResponse('```json\n{"intent":"GREETING","confidence":0.95}\n```');
    const result = await svc.classify('oi');
    expect(result.intent).toBe('GREETING');
  });

  it('falls back to OUT_OF_SCOPE on invalid JSON', async () => {
    mockResponse('not json at all');
    const result = await svc.classify('gibberish');
    expect(result.intent).toBe('OUT_OF_SCOPE');
    expect(result.confidence).toBe(0);
  });

  it('falls back to OUT_OF_SCOPE on schema validation failure', async () => {
    mockResponse({ intent: 'UNKNOWN_THING', confidence: 0.9 });
    const result = await svc.classify('???');
    expect(result.intent).toBe('OUT_OF_SCOPE');
  });

  it('downgrades low-confidence non-greeting intents to OUT_OF_SCOPE', async () => {
    mockResponse({ intent: 'EXPENSE', confidence: 0.3 });
    const result = await svc.classify('algo confuso');
    expect(result.intent).toBe('OUT_OF_SCOPE');
  });

  it('keeps GREETING even at low confidence', async () => {
    mockResponse({ intent: 'GREETING', confidence: 0.3 });
    const result = await svc.classify('eai?');
    expect(result.intent).toBe('GREETING');
  });

  it('returns OUT_OF_SCOPE without calling AI when text exceeds MAX_INPUT_LENGTH', async () => {
    const result = await svc.classify('a'.repeat(600));
    expect(result.intent).toBe('OUT_OF_SCOPE');
    expect(generateContent).not.toHaveBeenCalled();
  });
});
