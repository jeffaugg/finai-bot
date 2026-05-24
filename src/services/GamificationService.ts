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
    const despesasFixas = Number(user.fixed_expenses);
    const porcentagemEconomia = Number(user.saving_percentage);

    const rendaDisponivel = novaRenda - despesasFixas;
    const valorParaGastarMes = rendaDisponivel * (1 - porcentagemEconomia / 100);
    const novoLimiteDiario = valorParaGastarMes / 30;

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
      date: new Date(),
      deleted_at: null,
    });

    await this.eventRepo?.record(user.id, 'transaction_recorded', {
      transaction_id: transaction.id,
      amount: data.amount,
      category: data.category,
      type: 'EXPENSE',
    });

    const totalGastoHoje = await this.transactionRepo.getDailyExpenseTotal(user.id);
    const limiteRestante = Number(user.daily_limit) - totalGastoHoje;

    let message = `🛒 ${data.category}: R$ ${data.amount.toFixed(2)} registrados!\n`;

    if (limiteRestante > 0) {
      message += `Restam R$ ${limiteRestante.toFixed(2)} hoje. Mantenha o foco! 🔥`;
    } else {
      message +=
        `⚠️ Você estourou seu limite diário em R$ ${Math.abs(limiteRestante).toFixed(2)}.\n` +
        `Sua Reserva de Sucesso será acionada hoje à noite para tentar salvar sua ofensiva!`;
    }

    return { message, transactionId: transaction.id };
  }

  async closePendingDays(user: User): Promise<string | null> {
    const todayStr = dateService.getCurrentLocalDateString();
    const startStr = user.last_closed_date
      ? dateService.addDays(dateService.toDateString(user.last_closed_date), 1)
      : todayStr;

    if (startStr > todayStr) {
      return null;
    }

    let state: CloseState = {
      success_reserve: Number(user.success_reserve),
      current_streak: Number(user.current_streak),
      max_streak: Number(user.max_streak),
    };
    let lastMessage: string | null = null;

    for (const dateStr of dateService.dateRange(startStr, todayStr)) {
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
    if (await this.snapshots.existsForDate(user.id, dateStr)) {
      return null;
    }

    const totalGasto = await this.transactionRepo.getDailyExpenseTotal(user.id, dateStr);
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
        `✅ *Dia fechado com sucesso!*\n\n` +
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
          `⚠️ *Limite ultrapassado — Reserva acionada!*\n\n` +
          `Você gastou R$ ${totalGasto.toFixed(2)} (R$ ${excesso.toFixed(2)} a mais).\n` +
          `🛡️ Sua Reserva de Sucesso absorveu a diferença.\n` +
          `Reserva atual: R$ ${novaReserva.toFixed(2)}\n` +
          `🔥 Sequência mantida: ${novoStreak} dia${novoStreak > 1 ? 's' : ''}`;
      } else {
        novaReserva = 0;
        novoStreak = 0;
        closeResult = 'streak_reset';

        mensagem =
          `😔 *Dia difícil de fechar...*\n\n` +
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
    const limiteRestante = Number(user.daily_limit) - totalGastoHoje;

    return (
      `📊 *Seu status financeiro:*\n\n` +
      `🔥 Sequência: ${user.current_streak} dia${user.current_streak !== 1 ? 's' : ''} (recorde: ${user.max_streak})\n` +
      `🛡️ Reserva de Sucesso: R$ ${Number(user.success_reserve).toFixed(2)}\n` +
      `💰 Limite diário: R$ ${Number(user.daily_limit).toFixed(2)}\n` +
      `📉 Gasto hoje: R$ ${totalGastoHoje.toFixed(2)}\n` +
      (limiteRestante >= 0
        ? `✅ Restam: R$ ${limiteRestante.toFixed(2)} hoje`
        : `🚨 Estourou: R$ ${Math.abs(limiteRestante).toFixed(2)} acima do limite`)
    );
  }
}