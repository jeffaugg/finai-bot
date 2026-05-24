import { describe, it, expect } from 'vitest';
import { isWebhookAuthorized, isCronAuthorized } from '../../src/utils/auth';

describe('isWebhookAuthorized', () => {
  it('libera quando não há secret configurado', () => {
    expect(isWebhookAuthorized(undefined, undefined)).toBe(true);
    expect(isWebhookAuthorized('qualquer', undefined)).toBe(true);
  });

  it('exige token igual ao secret', () => {
    expect(isWebhookAuthorized('s3cr3t', 's3cr3t')).toBe(true);
    expect(isWebhookAuthorized('errado', 's3cr3t')).toBe(false);
    expect(isWebhookAuthorized(undefined, 's3cr3t')).toBe(false);
  });
});

describe('isCronAuthorized', () => {
  it('libera quando não há secret configurado', () => {
    expect(isCronAuthorized(undefined, undefined)).toBe(true);
  });

  it('exige Authorization Bearer <secret>', () => {
    expect(isCronAuthorized('Bearer s3cr3t', 's3cr3t')).toBe(true);
    expect(isCronAuthorized('Bearer errado', 's3cr3t')).toBe(false);
    expect(isCronAuthorized('s3cr3t', 's3cr3t')).toBe(false);
    expect(isCronAuthorized(undefined, 's3cr3t')).toBe(false);
  });
});
