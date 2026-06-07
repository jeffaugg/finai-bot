import { bot } from '../config/clients';
import { AgentService, AgentAction } from '../services/AgentService';
import { GamificationService } from '../services/GamificationService';
import { ModerationService } from '../services/ModerationService';
import { UserRepository } from '../repositories/UserRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { EventRepository } from '../repositories/EventRepository';
import { ConversationRepository } from '../repositories/ConversationRepository';
import { FeedbackRepository } from '../repositories/FeedbackRepository';
import { CapabilityGapRepository } from '../repositories/CapabilityGapRepository';
import { OnboardingHandler } from '../handlers/OnboardingHandler';
import { ExpenseHandler } from '../handlers/ExpenseHandler';
import { QueryHandler } from '../handlers/QueryHandler';
import { SmallTalkHandler } from '../handlers/SmallTalkHandler';
import { AgentRouter } from '../handlers/AgentRouter';
import { message } from 'telegraf/filters';
import { AppError } from '../types/errors';

const userRepo = new UserRepository();
const transactionRepo = new TransactionRepository();
const eventRepo = new EventRepository();
const conversationRepo = new ConversationRepository();
const feedbackRepo = new FeedbackRepository();
const capabilityGapRepo = new CapabilityGapRepository();
const gamificationService = new GamificationService(userRepo, transactionRepo, eventRepo);
const moderationService = new ModerationService();
const agentService = new AgentService();
const onboardingHandler = new OnboardingHandler(userRepo, eventRepo);
const expenseHandler = new ExpenseHandler(gamificationService);
const queryHandler = new QueryHandler(transactionRepo, eventRepo);
const smallTalkHandler = new SmallTalkHandler();
const agentRouter = new AgentRouter(
  expenseHandler,
  queryHandler,
  smallTalkHandler,
  capabilityGapRepo
);

function modelTurnContent(action: AgentAction): string {
  switch (action.tool) {
    case 'registrar_gasto':
      return `Registrei um gasto de R$ ${action.amount.toFixed(2)} em ${action.category}.`;
    case 'registrar_entrada':
      return `Registrei uma entrada de R$ ${action.amount.toFixed(2)}.`;
    case 'atualizar_salario':
      return `Atualizei o salário para R$ ${action.amount.toFixed(2)}.`;
    case 'consultar_resumo':
      return 'Mostrei o resumo de gastos.';
    case 'listar_transacoes':
      return 'Mostrei a lista de transações.';
    case 'consultar_limite_diario':
      return 'Informei quanto ainda dá pra gastar hoje.';
    case 'consultar_progresso':
      return 'Mostrei o progresso (sequência, reserva e limite).';
    case 'consultar_saldo_mensal':
      return 'Mostrei o saldo do mês.';
    case 'remover_transacao':
      return 'Pedi confirmação para remover um gasto.';
    case 'corrigir_ultimo_gasto':
      return `Corrigi o último gasto para R$ ${action.amount.toFixed(2)}.`;
    case 'reportar_lacuna':
      return 'Registrei um pedido que ainda não sei atender.';
    case 'none':
      return action.text ?? '';
  }
}

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
        await onboardingHandler.startFromScratch(ctx, user);
        return;
      }

      if (user.onboarding_step !== 'completed') {
        await onboardingHandler.resume(ctx, user);
        return;
      }

      await ctx.reply(
        `👋 Bem-vindo de volta, ${ctx.from.first_name}!\n` +
          `Use /status para ver seu progresso ou me conte um gasto/ganho do dia.`
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

  bot.command('feedback', async (ctx) => {
    const content = ctx.message.text.replace(/^\/feedback(@\w+)?\s*/i, '').trim();
    if (!content) {
      await ctx.reply(
        '💬 Mande seu feedback logo após o comando. Ex: "/feedback adoraria um gráfico mensal".'
      );
      return;
    }

    try {
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.reply('⚠️ Cadastro não encontrado. Digite /start para começar.');
        return;
      }
      await feedbackRepo.create(user.id, content);
      await ctx.reply('🙏 Obrigado pelo feedback! Sua opinião ajuda a melhorar o bot.');
    } catch (error) {
      console.error('Erro no /feedback:', error);
      await ctx.reply('⚠️ Não consegui salvar seu feedback agora. Tente em instantes.');
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
      await eventRepo.record(user.id, 'transaction_undone', {
        transaction_id: transactionId,
        via: 'undo',
      });
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

  bot.action(/^confirm_delete:(.+)$/, async (ctx) => {
    const transactionId = ctx.match[1];

    try {
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.answerCbQuery('⚠️ Cadastro não encontrado.');
        return;
      }

      await transactionRepo.softDelete(transactionId, user.id);
      await eventRepo.record(user.id, 'transaction_undone', {
        transaction_id: transactionId,
        via: 'delete',
      });
      await ctx.editMessageText('✅ Gasto removido com sucesso!');
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro ao remover gasto:', error);
      if (error instanceof AppError) {
        await ctx.answerCbQuery(error.userMessage);
      } else {
        await ctx.answerCbQuery('⚠️ Não consegui remover. Tente novamente.');
      }
    }
  });

  bot.action('cancel_delete', async (ctx) => {
    try {
      await ctx.editMessageText('❌ Operação cancelada.');
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro no cancel_delete:', error);
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^confirm_expense:(\d+(?:\.\d+)?):(.+)$/, async (ctx) => {
    const amount = Number(ctx.match[1]);
    const category = ctx.match[2];

    try {
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.answerCbQuery('⚠️ Cadastro não encontrado.');
        return;
      }

      const result = await gamificationService.processFinancialEvent(
        user.telegram_id,
        { intent: 'EXPENSE', amount, category },
        `${category} (R$ ${amount.toFixed(2)})`
      );
      await ctx.editMessageText(result.message);
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro ao confirmar gasto:', error);
      if (error instanceof AppError) {
        await ctx.answerCbQuery(error.userMessage);
      } else {
        await ctx.answerCbQuery('⚠️ Não consegui registrar. Tente novamente.');
      }
    }
  });

  bot.action('cancel_expense', async (ctx) => {
    try {
      await ctx.editMessageText('❌ Gasto não registrado.');
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro no cancel_expense:', error);
      await ctx.answerCbQuery();
    }
  });

  bot.action('reminder_done', async (ctx) => {
    try {
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (user) {
        await eventRepo.record(user.id, 'reminder_answered', { action: 'done' });
      }
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
        await eventRepo.record(user.id, 'reminder_answered', { action: 'snooze' });
      }
      await ctx.editMessageText('⏰ Ok! Vou te lembrar novamente em 1 hora.');
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Erro no callback snooze:', error);
      await ctx.answerCbQuery();
    }
  });

  bot.action(/^onboarding_reminders:(yes|no)$/, async (ctx) => {
    try {
      const accepted = ctx.match[1] === 'yes';
      const user = await userRepo.findByTelegramId(ctx.from.id);
      if (!user) {
        await ctx.answerCbQuery('⚠️ Cadastro não encontrado.');
        return;
      }
      await onboardingHandler.handleReminderChoice(ctx, user, accepted);
    } catch (error) {
      console.error('Erro no callback onboarding_reminders:', error);
      await ctx.answerCbQuery('⚠️ Erro ao salvar preferência. Tente novamente.');
    }
  });

  bot.on(message('text'), async (ctx) => {
    const userText = ctx.message.text;
    const telegramId = ctx.from.id;

    if (userText.startsWith('/')) return;

    const user = await userRepo.findByTelegramId(telegramId);

    if (user && user.onboarding_step !== 'completed') {
      try {
        await onboardingHandler.continue(ctx, user, userText);
      } catch (error) {
        console.error('Erro no onboarding:', error);
        await ctx.reply('⚠️ Tive um problema ao salvar. Tente novamente em instantes.');
      }
      return;
    }

    const moderation = moderationService.preCheck(userText);
    if (!moderation.allowed) {
      await ctx.reply(moderation.cannedResponse!);
      return;
    }

    if (!user) {
      await ctx.reply('⚠️ Cadastro não encontrado. Digite /start para começar.');
      return;
    }

    try {
      const history = await conversationRepo.recentWindow(user.id);
      const action = await agentService.interpret(userText, history);
      await agentRouter.dispatch(ctx, user, action, userText);

      await conversationRepo.append(user.id, 'user', userText);
      const modelTurn = modelTurnContent(action);
      if (modelTurn) {
        await conversationRepo.append(user.id, 'model', modelTurn);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      if (error instanceof AppError) {
        await ctx.reply(error.userMessage);
      } else {
        await ctx.reply(
          '🤖 Ops! Tive um problema ao processar sua mensagem. Pode tentar novamente?'
        );
      }
    }
  });

  // TODO — Reconhecimento de voz com Whisper para transcrever áudios
};
