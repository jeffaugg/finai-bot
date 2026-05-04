import { bot } from '../config/clients';
import { ExtractionService } from '../services/ExtractionService';
import { GamificationService } from '../services/GamificationService';
import { UserRepository } from '../repositories/UserRepository';
import { message } from 'telegraf/filters';

const extractionService = new ExtractionService();
const gamificationService = new GamificationService();
const userRepo = new UserRepository();

export const setupBotCommands = () => {
  /**
   * Fluxo de onboarding para novos usuários:
   * @param ctx - Contexto da mensagem de início (/start)
   */
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
          max_streak: 0
        });
      }

      await ctx.reply(
        `Olá, ${ctx.from.first_name}! 🚀 Bem-vindo ao seu ecossistema financeiro gamificado.\n\n` +
        `Para começar, me conte sobre a sua vida financeira em uma única mensagem, por exemplo:\n` +
        `"Meu salário é 3000"`
      );
    } catch (error) {
      console.error('Erro no Onboarding:', error);
      await ctx.reply('⚠️ Tivemos um pequeno problema técnico ao preparar seu perfil. Tente /start novamente em instantes.');
    }
  });



  /**
   * Fluxo para mensagens de texto:
   * @param ctx - Contexto da mensagem recebida
   */
  bot.on(message('text'), async (ctx) => {
    const userText = ctx.message.text;
    const telegramId = ctx.from.id;

    if (userText.startsWith('/')) return;

    try {
      await ctx.sendChatAction('typing');

      const extractedData = await extractionService.extractFromText(userText);

      const gamificationFeedback = await gamificationService.processFinancialEvent(telegramId, extractedData);

      await ctx.reply(gamificationFeedback);

    } catch (error) {
      console.error('Erro ao processar mensagem de texto:', error);
      await ctx.reply(
        '🤖 Ops! Minha inteligência artificial se confundiu com essa mensagem.\n' +
        'Você poderia reescrever de forma mais direta? Ex: "gastei 40 no mercado".'
      );
    }
  });

  // TODO - Implementar reconhecimento de voz usando uma API como Whisper para transcrever áudios e processar da mesma forma que mensagens de texto.
};