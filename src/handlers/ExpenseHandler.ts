import { Context, Markup } from 'telegraf';
import { DateService } from '../services/DateService';
import { GamificationService } from '../services/GamificationService';
import { GeminiExtraction, User } from '../types';
import { HIGH_VALUE_THRESHOLD } from '../types/constants';
import { AppError } from '../types/errors';

const dateService = new DateService();

export class ExpenseHandler {
  constructor(private readonly gamificationService: GamificationService) {}

  async handle(
    ctx: Context,
    user: User,
    extraction: GeminiExtraction,
    rawText: string
  ): Promise<void> {
    try {
      await ctx.sendChatAction('typing');

      if (extraction.intent === 'EXPENSE' && extraction.amount >= HIGH_VALUE_THRESHOLD) {
        const dateSuffix = extraction.date
          ? `:${dateService.getCurrentLocalDateString(undefined, extraction.date)}`
          : '';
        await ctx.reply(
          `Confirma o gasto de R$ ${extraction.amount.toFixed(2)} em ${extraction.category}` +
            `${extraction.date ? ' (ontem)' : ''}?`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                '✅ Confirmar',
                `confirm_expense:${extraction.amount}:${extraction.category}${dateSuffix}`
              ),
              Markup.button.callback('❌ Cancelar', 'cancel_expense'),
            ],
          ])
        );
        return;
      }

      const result = await this.gamificationService.processFinancialEvent(
        user.telegram_id,
        extraction,
        rawText
      );

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
      if (error instanceof AppError) {
        await ctx.reply(error.userMessage);
      } else {
        await ctx.reply(
          '🤖 Ops! Não consegui registrar agora. Pode reescrever de forma mais direta? Ex: "gastei 40 no mercado".'
        );
      }
    }
  }

  async correctLast(
    ctx: Context,
    user: User,
    newAmount: number,
    newCategory?: string
  ): Promise<void> {
    try {
      await ctx.sendChatAction('typing');

      const result = await this.gamificationService.correctLastExpense(
        user,
        newAmount,
        newCategory
      );

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
      console.error('Erro ao corrigir gasto:', error);
      if (error instanceof AppError) {
        await ctx.reply(error.userMessage);
      } else {
        await ctx.reply('🤖 Ops! Não consegui corrigir agora. Tente novamente.');
      }
    }
  }

  async updateFixedExpenses(ctx: Context, user: User, amount: number): Promise<void> {
    try {
      await ctx.sendChatAction('typing');
      const result = await this.gamificationService.updateFixedExpenses(user, amount);
      await ctx.reply(result.message);
    } catch (error) {
      console.error('Erro ao atualizar gastos fixos:', error);
      if (error instanceof AppError) {
        await ctx.reply(error.userMessage);
      } else {
        await ctx.reply('🤖 Ops! Não consegui atualizar agora. Tente novamente.');
      }
    }
  }

  async updateSavingPercentage(ctx: Context, user: User, percent: number): Promise<void> {
    try {
      await ctx.sendChatAction('typing');
      const result = await this.gamificationService.updateSavingPercentage(user, percent);
      await ctx.reply(result.message);
    } catch (error) {
      console.error('Erro ao atualizar meta de poupança:', error);
      if (error instanceof AppError) {
        await ctx.reply(error.userMessage);
      } else {
        await ctx.reply('🤖 Ops! Não consegui atualizar agora. Tente novamente.');
      }
    }
  }
}
