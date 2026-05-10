import {
  GREETING_PATTERNS,
  GREETING_RESPONSE,
  MAX_INPUT_LENGTH,
  MIN_INPUT_LENGTH,
  TOO_SHORT_RESPONSE,
} from '../types/constants';

export interface PreCheckResult {
  allowed: boolean;
  cannedResponse?: string;
  reason?: 'too_short' | 'too_long' | 'greeting';
}

export class ModerationService {
  preCheck(text: string): PreCheckResult {
    const trimmed = text.trim();

    if (trimmed.length < MIN_INPUT_LENGTH) {
      return { allowed: false, cannedResponse: TOO_SHORT_RESPONSE, reason: 'too_short' };
    }

    if (trimmed.length > MAX_INPUT_LENGTH) {
      return {
        allowed: false,
        cannedResponse: `📝 Sua mensagem ficou muito longa (${trimmed.length} caracteres). Tente resumir em até ${MAX_INPUT_LENGTH}.`,
        reason: 'too_long',
      };
    }

    for (const pattern of GREETING_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { allowed: false, cannedResponse: GREETING_RESPONSE, reason: 'greeting' };
      }
    }

    return { allowed: true };
  }
}
