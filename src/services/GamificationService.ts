import { EventRepository } from '../repositories/EventRepository';
import { SnapshotRepository } from '../repositories/SnapshotRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { CloseResult, FinancialEventResult, GeminiExtraction, User } from '../types';
import { DateService } from './DateService';

const dateService = new DateService();

interface CloseState {
  success_reserve: number;
  current_streak: number;
  max_streak: number;
}

export class GamificationService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly eventRepo?: EventRepository,
    private readonly snapshotRepo?: SnapshotRepository
  ) {}

  private get snapshots(): SnapshotRepository {
    if (!this.snapshotRepo) {
      throw new Error('SnapshotRepository é obrigatório para o fechamento diário');
    }
    return this.snapshotRepo;
  }

  async processFinancialEvent(
    telegramId: number,
    data: GeminiExtraction,
    rawText: string
  ): Promise<FinancialEventResult> {
    const user = await this.userRepo.findByTelegramId(telegramId);
    if (!user) {
      return {
        message:
          '⚠️ Não encontrei seu cadastro. Digite /start para iniciar nossa jornada financeira!',
      };
    }

    switch (data.intent) {
      case 'INFLOW':
        return this.handleInflow(user, data, rawText);

      case 'UPDATE_SALARY':
        return this.handleSalaryUpdate(user, data);

      case 'EXPENSE':
        return this.handleExpense(user, data, rawText);
    }
  }

  private async handleInflow(
    user: User,
    data: GeminiExtraction,
    rawText: string
  ): Promise<FinancialEventResult> {
    const newReserve = Number(user.success_reserve) + data.amount;

    const transaction = await this.transactionRepo.create({
      user_id: user.id,
      amount: data.amount,
      category: data.category,
      type: 'INFLOW',
      raw_text: rawText,
      date: new Date(),
      deleted_at: null,
    });

    await this.userRepo.updateUser(user.id, { success_reserve: newReserve });

    await this.eventRepo?.record(user.id, 'transaction_recorded', {
      transaction_id: transaction.id,
      amount: data.amount,
      category: data.category,
      type: 'INFLOW',
    });

    return {
      message:
        `🎉 Renda extra de R$ ${data.amount.toFixed(2)} registrada!\n` +
        `Esse valor foi direto para sua Reserva de Sucesso, que agora é de R$ ${newReserve.toFixed(2)}. Proteja seu colchão! 🛡️`,
    };
  }

  private async handleSalaryUpdate(
    user: User,
    data: GeminiExtraction
  ): Promise<FinancialEventResult> {
    const novaRenda = data.amount;
    const novoLimiteDiario = calculateDailyLimit(
      novaRenda,
      Number(user.fixed_expenses),
      Number(user.saving_percentage)
    );

    await this.userRepo.updateUser(user.id, {
      monthly_income: novaRenda,
      daily_limit: novoLimiteDiario,
    });

    await this.eventRepo?.record(user.id, 'salary_updated', {
      monthly_income: novaRenda,
      daily_limit: novoLimiteDiario,
    });

    return {
      message:
        `📈 Renda atualizada para R$ ${novaRenda.toFixed(2)}!\n` +
        `Seu novo limite diário recalculado é R$ ${novoLimiteDiario.toFixed(2)}.`,
    };
  }

  async updateFixedExpenses(user: User, amount: number): Promise<FinancialEventResult> {
    const novoLimiteDiario = calculateDailyLimit(
      Number(user.monthly_income),
      amount,
      Number(user.saving_percentage)
    );

    await this.userRepo.updateUser(user.id, {
      fixed_expenses: amount,
      daily_limit: novoLimiteDiario,
    });

    await this.eventRepo?.record(user.id, 'profile_updated', {
      field: 'fixed_expenses',
      value: amount,
      daily_limit: novoLimiteDiario,
    });

    return {
      message:
        `🏠 Gastos fixos atualizados para R$ ${amount.toFixed(2)}!\n` +
        `Seu novo limite diário recalculado é R$ ${novoLimiteDiario.toFixed(2)}.`,
    };
  }

  async updateSavingPercentage(user: User, percent: number): Promise<FinancialEventResult> {
    const novoLimiteDiario = calculateDailyLimit(
      Number(user.monthly_income),
      Number(user.fixed_expenses),
      percent
    );

    await this.userRepo.updateUser(user.id, {
      saving_percentage: percent,
      daily_limit: novoLimiteDiario,
    });

    await this.eventRepo?.record(user.id, 'profile_updated', {
      field: 'saving_percentage',
      value: percent,
      daily_limit: novoLimiteDiario,
    });

    return {
      message:
        `🎯 Meta de poupança atualizada para ${percent}% da renda!\n` +
        `Seu novo limite diário recalculado é R$ ${novoLimiteDiario.toFixed(2)}.`,
    };
  }

  private async handleExpense(
    user: User,
    data: GeminiExtraction,
    rawText: string
  ): Promise<FinancialEventResult> {
    const transaction = await this.transactionRepo.create({
      user_id: user.id,
      amount: data.amount,
      category: data.category,
      type: 'EXPENSE',
      raw_text: rawText,
      date: data.date ?? new Date(),
      deleted_at: null,
    });

    await this.eventRepo?.record(user.id, 'transaction_recorded', {
      transaction_id: transaction.id,
      amount: data.amount,
      category: data.category,
      type: 'EXPENSE',
      ...(data.date ? { transaction_date: data.date.toISOString() } : {}),
    });

    if (data.date) {
      return {
        message:
          `🛒 ${data.category}: R$ ${data.amount.toFixed(2)} registrados pra ontem!\n` +
          `Esse gasto não altera seu limite de hoje.`,
        transactionId: transaction.id,
      };
    }

    const totalGastoHoje = await this.transactionRepo.getDailyExpenseTotal(user.id);
    const limiteRestante = Number(user.daily_limit) - totalGastoHoje;

    let message = `🛒 ${data.category}: R$ ${data.amount.toFixed(2)} registrados!\n`;

    if (limiteRestante > 0) {
      message += `Restam R$ ${limiteRestante.toFixed(2)} hoje. Mantenha o foco! 🔥`;
    } else {
      message +=
        `⚠️ Você estourou seu limite diário em R$ ${Math.abs(limiteRestante).toFixed(2)}.\n` +
        `Sua Reserva de Sucesso será acionada hoje à noite para tentar salvar sua ofensiva!\n\n` +
        `Quer ver onde foi hoje? É só pedir "resumo de hoje".`;
    }

    return { message, transactionId: transaction.id };
  }

  async correctLastExpense(
    user: User,
    newAmount: number,
    newCategory?: string
  ): Promise<FinancialEventResult> {
    const last = await this.transactionRepo.findLastExpense(user.id);
    if (!last) {
      return { message: '🤔 Não encontrei um gasto recente para corrigir.' };
    }

    await this.transactionRepo.softDelete(last.id, user.id);

    const category = newCategory ?? last.category;
    const transaction = await this.transactionRepo.create({
      user_id: user.id,
      amount: newAmount,
      category,
      type: 'EXPENSE',
      raw_text: `[correção] ${last.raw_text}`,
      date: last.date,
      deleted_at: null,
    });

    await this.eventRepo?.record(user.id, 'transaction_corrected', {
      old_transaction_id: last.id,
      new_transaction_id: transaction.id,
      old_amount: Number(last.amount),
      new_amount: newAmount,
      category,
    });

    return {
      message:
        `✏️ Gasto corrigido!\n` +
        `De R$ ${Number(last.amount).toFixed(2)} para R$ ${newAmount.toFixed(2)} em ${category}.`,
      transactionId: transaction.id,
    };
  }

  async closePendingDays(user: User): Promise<string | null> {
    const targetStr = dateService.addDays(dateService.getCurrentLocalDateString(), -1);
    const startStr = user.last_closed_date
      ? dateService.addDays(dateService.toDateString(user.last_closed_date), 1)
      : dateService.getCurrentLocalDateString(undefined, user.created_at);

    if (startStr > targetStr) {
      return null;
    }

    let state: CloseState = {
      success_reserve: Number(user.success_reserve),
      current_streak: Number(user.current_streak),
      max_streak: Number(user.max_streak),
    };
    let lastMessage: string | null = null;

    for (const dateStr of dateService.dateRange(startStr, targetStr)) {
      const result = await this.closeDay({ ...user, ...state }, dateStr);
      if (result) {
        state = result.state;
        lastMessage = result.message;
      }
    }

    return lastMessage;
  }

  async closeDay(
    user: User,
    dateStr: string
  ): Promise<{ message: string; state: CloseState } | null> {
    if (dateStr >= dateService.getCurrentLocalDateString()) {
      return null;
    }

    if (await this.snapshots.existsForDate(user.id, dateStr)) {
      return null;
    }

    const totalGasto = await this.transactionRepo.getDailyExpenseTotal(user.id, dateStr);
    const diaFormatado = formatLocalDateString(dateStr);
    const limite = Number(user.daily_limit);
    const reservaAtual = Number(user.success_reserve);
    const streakAtual = Number(user.current_streak);
    const maxStreak = Number(user.max_streak);

    let novaReserva = reservaAtual;
    let novoStreak = streakAtual;
    let novoMaxStreak = maxStreak;
    let closeResult: CloseResult;
    let mensagem: string;

    if (totalGasto <= limite) {
      const surplus = limite - totalGasto;
      novaReserva = reservaAtual + surplus;
      novoStreak = streakAtual + 1;
      novoMaxStreak = Math.max(maxStreak, novoStreak);
      closeResult = 'success';

      mensagem =
        `✅ *Dia ${diaFormatado} fechado com sucesso!*\n\n` +
        `Você gastou R$ ${totalGasto.toFixed(2)} de um limite de R$ ${limite.toFixed(2)}.\n` +
        `💰 Economia do dia: R$ ${surplus.toFixed(2)} → adicionados à Reserva!\n` +
        `🛡️ Reserva de Sucesso: R$ ${novaReserva.toFixed(2)}\n` +
        `🔥 Sequência: ${novoStreak} dia${novoStreak > 1 ? 's' : ''}` +
        (novoStreak === novoMaxStreak && novoStreak > 1 ? ' 🏆 Novo recorde!' : '');
    } else {
      const excesso = totalGasto - limite;

      if (reservaAtual >= excesso) {
        novaReserva = reservaAtual - excesso;
        closeResult = 'reserve_used';

        mensagem =
          `⚠️ *Dia ${diaFormatado}: limite ultrapassado — Reserva acionada!*\n\n` +
          `Você gastou R$ ${totalGasto.toFixed(2)} (R$ ${excesso.toFixed(2)} a mais).\n` +
          `🛡️ Sua Reserva de Sucesso absorveu a diferença.\n` +
          `Reserva atual: R$ ${novaReserva.toFixed(2)}\n` +
          `🔥 Sequência mantida: ${novoStreak} dia${novoStreak > 1 ? 's' : ''}`;
      } else {
        novaReserva = 0;
        novoStreak = 0;
        closeResult = 'streak_reset';

        mensagem =
          `😔 *Dia ${diaFormatado} difícil de fechar...*\n\n` +
          `Você gastou R$ ${totalGasto.toFixed(2)} (R$ ${excesso.toFixed(2)} além do limite e da reserva).\n` +
          `Sua sequência foi resetada. Mas amanhã é um novo dia! 💪\n` +
          `🔥 Sequência: 0 dias`;
      }
    }

    const snapshot = await this.snapshots.insert({
      user_id: user.id,
      snapshot_date: dateStr,
      current_streak: novoStreak,
      success_reserve: novaReserva,
      daily_limit: limite,
      total_spent: totalGasto,
      had_activity: totalGasto > 0,
      close_result: closeResult,
    });

    if (!snapshot) {
      return null;
    }

    await this.userRepo.updateUser(user.id, {
      success_reserve: novaReserva,
      current_streak: novoStreak,
      max_streak: novoMaxStreak,
      last_closed_date: new Date(dateStr),
    });

    await this.eventRepo?.record(user.id, 'daily_closed', {
      snapshot_date: dateStr,
      total_spent: totalGasto,
      close_result: closeResult,
      current_streak: novoStreak,
      success_reserve: novaReserva,
    });

    return {
      message: mensagem,
      state: {
        success_reserve: novaReserva,
        current_streak: novoStreak,
        max_streak: novoMaxStreak,
      },
    };
  }

  async getStatus(telegramId: number): Promise<string> {
    const user = await this.userRepo.findByTelegramId(telegramId);
    if (!user) {
      return '⚠️ Cadastro não encontrado. Digite /start para começar.';
    }

    const totalGastoHoje = await this.transactionRepo.getDailyExpenseTotal(user.id);
    return formatStatus(user, totalGastoHoje);
  }
}

function formatLocalDateString(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

export function calculateDailyLimit(
  monthlyIncome: number,
  fixedExpenses: number,
  savingPercentage: number
): number {
  const rendaDisponivel = monthlyIncome - fixedExpenses;
  const valorParaGastarMes = rendaDisponivel * (1 - savingPercentage / 100);
  return valorParaGastarMes / 30;
}

export function formatBudget(user: User, totalGastoHoje: number): string {
  const limiteRestante = Number(user.daily_limit) - totalGastoHoje;

  return (
    `💰 Limite diário: R$ ${Number(user.daily_limit).toFixed(2)}\n` +
    `📉 Gasto hoje: R$ ${totalGastoHoje.toFixed(2)}\n` +
    (limiteRestante >= 0
      ? `✅ Restam: R$ ${limiteRestante.toFixed(2)} hoje`
      : `🚨 Estourou: R$ ${Math.abs(limiteRestante).toFixed(2)} acima do limite`)
  );
}

export function formatStatus(user: User, totalGastoHoje: number): string {
  return (
    `📊 *Seu status financeiro:*\n\n` +
    `🔥 Sequência: ${user.current_streak} dia${user.current_streak !== 1 ? 's' : ''} (recorde: ${user.max_streak})\n` +
    `🛡️ Reserva de Sucesso: R$ ${Number(user.success_reserve).toFixed(2)}\n` +
    formatBudget(user, totalGastoHoje)
  );
}