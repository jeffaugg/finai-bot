export const GEMINI_MODEL = 'gemini-2.5-flash';
export const MAX_INPUT_LENGTH = 500;

export const TIMEZONE = 'America/Sao_Paulo';

export const MIN_INPUT_LENGTH = 2;
export const HIGH_VALUE_THRESHOLD = 500;

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

export const HELP_RESPONSE =
  '🤖 *Como eu funciono:*\n\n' +
  '• Me conte um gasto: "gastei 40 no mercado" (ou "ontem gastei 25 na padaria")\n' +
  '• Me conte um ganho extra: "recebi 200 de bônus"\n' +
  '• Atualize seu perfil: "meu salário agora é 4000", "minhas contas fixas são 1200", "quero poupar 30%"\n' +
  '• Peça um resumo: "quanto gastei hoje?"\n' +
  '• Controle os lembretes: "para de me lembrar"\n\n' +
  'Comandos disponíveis:\n' +
  '/status — seu progresso atual\n' +
  '/historico — últimos 3 meses\n' +
  '/feedback — envie uma sugestão';

export const QUERY_NOT_IMPLEMENTED_RESPONSE =
  '🛠️ Estou aprendendo a responder esse tipo de pergunta. Por enquanto, use /status ou /historico.';

export const VOICE_NOT_SUPPORTED_RESPONSE =
  '🎙️ Ainda não consigo entender áudios, mas isso está chegando em breve! Por enquanto, me conte por texto. Ex: "gastei 40 no mercado".';

export const PHOTO_NOT_SUPPORTED_RESPONSE =
  '📷 Ainda não consigo ler imagens (como fotos de comprovantes), mas isso está chegando em breve! Por enquanto, me conte por texto. Ex: "gastei 40 no mercado".';

export const CANONICAL_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Educação',
  'Lazer',
  'Exercícios',
  'Pet',
  'Vestuário',
  'Beleza',
  'Presentes',
  'Bônus',
  'Salário',
  'Outros',
] as const;
