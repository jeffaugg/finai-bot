import { describe, it, expect } from 'vitest';
import { ModerationService } from '../../src/services/ModerationService';

const svc = new ModerationService();

describe('ModerationService.preCheck', () => {
  it('rejects empty / single-char messages', () => {
    expect(svc.preCheck('').allowed).toBe(false);
    expect(svc.preCheck(' ').allowed).toBe(false);
    expect(svc.preCheck('a').allowed).toBe(false);
  });

  it('rejects messages over MAX_INPUT_LENGTH', () => {
    const r = svc.preCheck('a'.repeat(600));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('too_long');
  });

  it('intercepts common greetings without calling AI', () => {
    const greetings = [
      'oi',
      'Oi!',
      'olá',
      'Olá.',
      'bom dia',
      'Boa tarde',
      'BOA NOITE',
      'tudo bem?',
      'tudo certo',
      'obrigado',
      'valeu!',
      'vlw',
      'beleza',
    ];
    for (const g of greetings) {
      const r = svc.preCheck(g);
      expect(r.allowed, `should intercept "${g}"`).toBe(false);
      expect(r.reason).toBe('greeting');
    }
  });

  it('lets through real financial messages', () => {
    const messages = [
      'gastei 40 no mercado',
      'recebi 200 de bônus',
      'meu salário agora é 4000',
      'quanto gastei hoje?',
      'me mostra meus gastos com lazer',
    ];
    for (const m of messages) {
      const r = svc.preCheck(m);
      expect(r.allowed, `should allow "${m}"`).toBe(true);
    }
  });
});
