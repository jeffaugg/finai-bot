import { Markup } from 'telegraf';
import { bot } from '../config/clients';
import { ExtractionService } from '../services/ExtractionService';
import { GamificationService } from '../services/GamificationService';
import { ModerationService } from '../services/ModerationService';
import { UserRepository } from '../repositories/UserRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { message } from 'telegraf/filters';
import { AIExtractionError, AppError } from '../types/errors';

const userRepo = new UserRepository();
const transactionRepo = new TransactionRepository();
const extractionService = new ExtractionService();
const gamificationService = new GamificationService(userRepo, transactionRepo);
const moderationService = new ModerationService();

export const setupBotCommands = () => {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      let user = await userRepo.findByTelegramId(telegramId);

      if (!user) {
        user = await userRepo.createUser({
          telegram_id: telegramId,
          monthly_income: 0,
          fixed_expenses: 0,
          saving_percentage: 20,
          daily_limit: 0,
          success_reserve: 0,
          current_streak: 0,
          max_streak: 0,
        });
      }

      await ctx.reply(
        `Olá, ${ctx.from.first_name}! 🚀 Bem-vindo ao seu ecossistema financeiro gamificado.\n\n` +
          `Para começar, me conte sobre a sua vida financeira em uma única mensagem, por exemplo:\n` +
          `"Meu salário é 3000"`
      );
    } catch (error) {
      console.error('Erro no Onboarding:', error);
      await ctx.reply(
        '⚠️ Tivemos um pequeno problema técnico ao preparar seu perfil. Tente /start novamente em instantes.'
      );
    }
  });

  bot.command('status', async (ctx) => {
    try {
      const statusMessage = await gamificationService.getStatus(ctx.from.id);
      await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Erro no /status:', error);
      await ctx.reply('⚠️ Não consegui buscar seu status agora. Tente em instantes.');
    }
  });

  bot.command('historico', async (ctx) => {
    try {
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.reply('⚠️ Cadastro não encontrado. Digite /start para começar.');
        return;
      }

      const now = new Date();
      let report = '📋 *Histórico dos últimos 3 meses:*\n';

      for (let i = 0; i < 3; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthName = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        const summary = await transactionRepo.getMonthlySummary(user.id, year, month);

        if (summary.length === 0) {
          report += `\n📅 *${monthName}:* Sem registros\n`;
          continue;
        }

        const total = summary.reduce((acc, s) => acc + s.total, 0);
        report += `\n📅 *${monthName}* — Total: R$ ${total.toFixed(2)}\n`;
        for (const { category, total: catTotal } of summary.slice(0, 5)) {
          report += `  • ${category}: R$ ${catTotal.toFixed(2)}\n`;
        }
      }

      await ctx.reply(report, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Erro no /historico:', error);
      await ctx.reply('⚠️ Não consegui buscar seu histórico agora. Tente em instantes.');
    }
  });

  bot.action(/^undo:(.+)$/, async (ctx) => {
    const transactionId = ctx.match[1];

    try {
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.answerCbQuery('⚠️ Cadastro não encontrado.');
        return;
      }

      await transactionRepo.softDelete(transactionId, user.id);
      await ctx.editMessageText('✅ Gasto desfeito com sucesso!');
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro ao desfazer gasto:', error);
      if (error instanceof AppError) {
        await ctx.answerCbQuery(error.userMessage);
      } else {
        await ctx.answerCbQuery('⚠️ Não consegui desfazer. Tente novamente.');
      }
    }
  });

  bot.action('reminder_done', async (ctx) => {
    try {
      await ctx.editMessageText('✅ Ótimo! Seus gastos de hoje estão registrados. Continue assim! 🔥');
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro no callback reminder_done:', error);
      await ctx.answerCbQuery();
    }
  });

  bot.action('reminder_snooze', async (ctx) => {
    try {
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (user) {
        const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000); // +1h
        await userRepo.updateUser(user.id, {
          snooze_until: snoozeUntil,
        });
      }
      await ctx.editMessageText('⏰ Ok! Vou te lembrar novamente em 1 hora.');
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro no callback snooze:', error);
      await ctx.answerCbQuery();
    }
  });

  bot.on(message('text'), async (ctx) => {
    const userText = ctx.message.text;
    const telegramId = ctx.from.id;

    if (userText.startsWith('/')) return;

    const moderation = moderationService.preCheck(userText);
    if (!moderation.allowed) {
      await ctx.reply(moderation.cannedResponse!);
      return;
    }

    try {
      await ctx.sendChatAction('typing');

      const extractedData = await extractionService.extractFromText(userText);
      const result = await gamificationService.processFinancialEvent(telegramId, extractedData);

      if (result.transactionId) {
        await ctx.reply(
          result.message,
          Markup.inlineKeyboard([Markup.button.callback('❌ Desfazer', `undo:${result.transactionId}`)])
        );
      } else {
        await ctx.reply(result.message);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);

      if (error instanceof AppError) {
        await ctx.reply(error.userMessage);
      } else if (error instanceof AIExtractionError) {
        await ctx.reply(error.userMessage);
      } else {
        await ctx.reply(
          '🤖 Ops! Minha inteligência artificial se confundiu com essa mensagem.\n' +
            'Você poderia reescrever de forma mais direta? Ex: "gastei 40 no mercado".'
        );
      }
    }
  });

  // TODO — Reconhecimento de voz com Whisper para transcrever áudios
};
