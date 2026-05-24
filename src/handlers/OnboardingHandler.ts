import { Context, Markup } from 'telegraf';
import { EventRepository } from '../repositories/EventRepository';
import { UserRepository } from '../repositories/UserRepository';
import { OnboardingStep, User } from '../types';
import { parseAmount, parsePercentage } from '../utils/parse';

const REMINDER_KEYBOARD = Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ Sim, quero', 'onboarding_reminders:yes'),
    Markup.button.callback('🔕 Não, obrigado', 'onboarding_reminders:no'),
  ],
]);

function calcDailyLimit(monthlyIncome: number, fixedExpenses: number, savingPct: number): number {
  const available = monthlyIncome - fixedExpenses;
  const monthlySpend = available * (1 - savingPct / 100);
  return Math.max(0, monthlySpend / 30);
}

export class OnboardingHandler {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly eventRepo?: EventRepository
  ) {}

  async startFromScratch(ctx: Context, user: User): Promise<User> {
    await ctx.reply(
      `Olá, ${ctx.from?.first_name ?? ''}! 🚀\n\n` +
        `Sou seu assistente financeiro gamificado. Vou te fazer 4 perguntas rápidas para configurar sua jornada.`
    );
    await this.eventRepo?.record(user.id, 'onboarding_started');
    return this.askSalary(ctx, user);
  }

  async resume(ctx: Context, user: User): Promise<void> {
    switch (user.onboarding_step) {
      case 'not_started':
      case 'awaiting_salary':
        await this.askSalary(ctx, user);
        return;
      case 'awaiting_fixed_expenses':
        await this.askFixedExpenses(ctx);
        return;
      case 'awaiting_saving_pct':
        await this.askSavingPct(ctx);
        return;
      case 'awaiting_reminder_pref':
        await this.askReminderPref(ctx);
        return;
      case 'completed':
        return;
    }
  }

  async continue(ctx: Context, user: User, text: string): Promise<void> {
    switch (user.onboarding_step) {
      case 'not_started':
      case 'awaiting_salary':
        await this.handleSalary(ctx, user, text);
        return;
      case 'awaiting_fixed_expenses':
        await this.handleFixedExpenses(ctx, user, text);
        return;
      case 'awaiting_saving_pct':
        await this.handleSavingPct(ctx, user, text);
        return;
      case 'awaiting_reminder_pref':
        await ctx.reply('Quase lá! Use os botões abaixo para escolher 👇');
        await this.askReminderPref(ctx);
        return;
      case 'completed':
        return;
    }
  }

  async handleReminderChoice(ctx: Context, user: User, accepted: boolean): Promise<void> {
    if (user.onboarding_step !== 'awaiting_reminder_pref') {
      await ctx.answerCbQuery();
      return;
    }

    const dailyLimit = calcDailyLimit(
      Number(user.monthly_income),
      Number(user.fixed_expenses),
      Number(user.saving_percentage)
    );

    await this.userRepo.updateUser(user.id, {
      reminders_enabled: accepted,
      daily_limit: dailyLimit,
      onboarding_step: 'completed',
    });

    await this.eventRepo?.record(user.id, 'onboarding_completed', {
      daily_limit: dailyLimit,
      reminders_enabled: accepted,
    });

    await ctx.editMessageText(
      accepted
        ? '✅ Perfeito! Vou te lembrar de registrar seus gastos diariamente.'
        : '🔕 Sem problema, sem lembretes diários.'
    );

    await ctx.reply(
      `🎉 Tudo pronto! Seu limite diário é de R$ ${dailyLimit.toFixed(2)}.\n\n` +
        `Agora é só me contar seus gastos e ganhos no dia a dia. Exemplos:\n` +
        `• "gastei 40 no mercado"\n` +
        `• "recebi 200 de bônus"\n` +
        `• "/status" para ver seu progresso`
    );

    await ctx.answerCbQuery();
  }

  private async askSalary(ctx: Context, user: User): Promise<User> {
    if (user.onboarding_step !== 'awaiting_salary') {
      await this.userRepo.updateUser(user.id, { onboarding_step: 'awaiting_salary' });
    }
    await ctx.reply('💰 Qual seu salário líquido mensal? (ex: 3000 ou R$ 3.000,00)');
    return user;
  }

  private async askFixedExpenses(ctx: Context): Promise<void> {
    await ctx.reply(
      '🏠 Quanto você tem de despesas fixas por mês (aluguel, contas, assinaturas)?\n' +
        'Se não tem, pode mandar 0.'
    );
  }

  private async askSavingPct(ctx: Context): Promise<void> {
    await ctx.reply(
      '🐷 Qual % do que sobra você quer poupar? (ex: 20 para 20%)\n' +
        'Sugiro 20% — mas você escolhe.'
    );
  }

  private async askReminderPref(ctx: Context): Promise<void> {
    await ctx.reply(
      '🔔 Quer que eu te lembre todo dia às 23h de registrar seus gastos?',
      REMINDER_KEYBOARD
    );
  }

  private async handleSalary(ctx: Context, user: User, text: string): Promise<void> {
    const amount = parseAmount(text);
    if (amount === null || amount <= 0) {
      await ctx.reply('🤔 Não entendi esse valor. Mande só o número, ex: 3000 ou R$ 3.500,00.');
      return;
    }
    await this.advance(user.id, 'awaiting_fixed_expenses', { monthly_income: amount });
    await this.askFixedExpenses(ctx);
  }

  private async handleFixedExpenses(ctx: Context, user: User, text: string): Promise<void> {
    const amount = parseAmount(text);
    if (amount === null) {
      await ctx.reply('🤔 Não entendi. Mande um número, ex: 1500 ou 0 se não tiver despesas fixas.');
      return;
    }
    await this.advance(user.id, 'awaiting_saving_pct', { fixed_expenses: amount });
    await this.askSavingPct(ctx);
  }

  private async handleSavingPct(ctx: Context, user: User, text: string): Promise<void> {
    const pct = parsePercentage(text);
    if (pct === null) {
      await ctx.reply('🤔 Mande um número entre 0 e 100, ex: 20 ou 20%.');
      return;
    }
    await this.advance(user.id, 'awaiting_reminder_pref', { saving_percentage: pct });
    await this.askReminderPref(ctx);
  }

  private async advance(
    userId: string,
    nextStep: OnboardingStep,
    extra: Partial<User>
  ): Promise<void> {
    await this.userRepo.updateUser(userId, { ...extra, onboarding_step: nextStep });
  }
}
