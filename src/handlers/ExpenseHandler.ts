import { Context, Markup } from 'telegraf';
import { ExtractionService } from '../services/ExtractionService';
import { GamificationService } from '../services/GamificationService';
import { User } from '../types';
import { AIExtractionError, AppError } from '../types/errors';

export class ExpenseHandler {
  constructor(
    private readonly extractionService: ExtractionService,
    private readonly gamificationService: GamificationService
  ) {}

  async handle(ctx: Context, user: User, text: string): Promise<void> {
    try {
      await ctx.sendChatAction('typing');

      const extracted = await this.extractionService.extractFromText(text);
      const result = await this.gamificationService.processFinancialEvent(user.telegram_id, extracted);

      if (result.transactionId) {
        await ctx.reply(
          result.message,
          Markup.inlineKeyboard([
            Markup.button.callback('❌ Desfazer', `undo:${result.transactionId}`),
          ])
        );
      } else {
        await ctx.reply(result.message);
      }
    } catch (error) {
      console.error('Erro no ExpenseHandler:', error);
      if (error instanceof AIExtractionError || error instanceof AppError) {
        await ctx.reply(error.userMessage);
      } else {
        await ctx.reply(
          '🤖 Ops! Não consegui registrar agora. Pode reescrever de forma mais direta? Ex: "gastei 40 no mercado".'
        );
      }
    }
  }
}
