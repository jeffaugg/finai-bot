export const GEMINI_MODEL = 'gemini-2.5-flash';
export const RAW_TEXT_AI_PROCESSED = 'Processado via IA';
export const MAX_INPUT_LENGTH = 500;

export const TIMEZONE = 'America/Sao_Paulo';

export const MIN_INPUT_LENGTH = 2;

export const GREETING_PATTERNS: RegExp[] = [
  /^\s*(oi+|ol[áa]+|hello|hey|hi)\s*[!.?]*\s*$/i,
  /^\s*(bom\s+dia|boa\s+tarde|boa\s+noite)\s*[!.?]*\s*$/i,
  /^\s*(tudo\s+bem|td\s+bem|tudo\s+certo|tudo\s+ok)\s*[!.?]*\s*$/i,
  /^\s*(obrigad[oa]+|valeu|vlw|thanks?|tks)\s*[!.?]*\s*$/i,
  /^\s*(blz|beleza|de\s+boa)\s*[!.?]*\s*$/i,
];

export const GREETING_RESPONSE =
  '👋 Olá! Sou seu assistente financeiro. Você pode me contar um gasto, um ganho ou pedir um resumo. Ex: "gastei 40 no mercado".';

export const TOO_SHORT_RESPONSE =
  '🤔 Não entendi. Pode tentar de novo, ex: "gastei 40 no mercado" ou "quanto gastei hoje?".';

export const OFF_TOPIC_RESPONSE =
  '🤖 Sou um assistente focado em finanças. Posso te ajudar com seus gastos, ganhos ou um resumo do mês.';
