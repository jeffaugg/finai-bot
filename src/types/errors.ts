export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AIExtractionError extends AppError {
  constructor(detail: string) {
    super(
      `AI extraction failed: ${detail}`,
      'AI_EXTRACTION_ERROR',
      '🤖 Não consegui entender essa mensagem. Tente ser mais direto, ex: "gastei 40 no mercado".'
    );
  }
}

export class DatabaseError extends AppError {
  constructor(detail: string) {
    super(
      `Database operation failed: ${detail}`,
      'DATABASE_ERROR',
      '⚠️ Tive um problema ao acessar seus dados. Tente novamente em instantes.'
    );
  }
}
