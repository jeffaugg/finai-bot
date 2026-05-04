
import { TransactionRepository } from '../repositories/TransactionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { GeminiExtraction, User } from '../types';

export class GamificationService {
  private userRepo: UserRepository;
  private transactionRepo: TransactionRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.transactionRepo = new TransactionRepository();
  }

  /**
   * Processa um evento financeiro extraído do texto do usuário e atualiza o perfil gamificado
    * @param telegramId - O ID do Telegram do usuário
    * @param data - Os dados extraídos do texto, incluindo intenção, valor, categoria e data
    * @returns Uma mensagem de feedback personalizada para o usuário com base no evento processado
   */
  async processFinancialEvent(telegramId: number, data: GeminiExtraction): Promise<string> {
    const user = await this.userRepo.findByTelegramId(telegramId);
    if (!user) {
      return "⚠️ Não encontrei seu cadastro. Digite /start para iniciar nossa jornada financeira!";
    }

    switch (data.intent) {
      case 'INFLOW':
        return this.handleInflow(user, data);
      
      case 'UPDATE_SALARY':
        return this.handleSalaryUpdate(user, data);
      
      case 'EXPENSE':
      default:
        return this.handleExpense(user, data);
    }
  }

  /**
   * Lida com eventos de entrada de dinheiro (renda extra) e atualiza a Reserva de Sucesso do usuário
   * @param user - O perfil do usuário para o qual o evento está sendo processado
   * @param data - Os dados extraídos do texto
   * @returns A mensagem de feedback personalizada para o usuário
   */
  private async handleInflow(user: User, data: GeminiExtraction): Promise<string> {
    const newReserve = Number(user.success_reserve) + data.amount;
    
    await this.userRepo.updateUser(user.id, { success_reserve: newReserve });
    
    await this.transactionRepo.create({
      user_id: user.id,
      amount: data.amount,
      category: data.category,
      type: 'INFLOW',
      raw_text: "Processado via IA",
      date: new Date(data.date_iso),
      deleted_at: null
    });

    return `🎉 Renda extra de R$ ${data.amount.toFixed(2)} registrada!\nEsse valor foi direto para sua Reserva de Sucesso, que agora é de R$ ${newReserve.toFixed(2)}. Proteja seu colchão! 🛡️`;
  }

  /**
   * Lida com atualizações de salário e recalcula o limite diário do usuário
   * @param user - O perfil do usuário para o qual o evento está sendo processado
   * @param data - Os dados extraídos do texto
   * @returns A mensagem de feedback personalizada para o usuário
   */

  private async handleSalaryUpdate(user: User, data: GeminiExtraction): Promise<string> {
    const novaRenda = data.amount;
    const despesasFixas = Number(user.fixed_expenses);
    const porcentagemEconomia = Number(user.saving_percentage);

    const rendaDisponivel = novaRenda - despesasFixas;
    const valorParaGastarMes = rendaDisponivel * (1 - (porcentagemEconomia / 100));
    const novoLimiteDiario = valorParaGastarMes / 30;

    await this.userRepo.updateUser(user.id, { 
      monthly_income: novaRenda,
      daily_limit: novoLimiteDiario
    });

    return `📈 Renda atualizada para R$ ${novaRenda.toFixed(2)}!\nSeu novo limite diário recalculado para manter sua meta de poupança agora é R$ ${novoLimiteDiario.toFixed(2)}.`;
  }


  /**
   * Lida com eventos de despesa, registra a transação e fornece feedback sobre o limite diário
   * @param user - O perfil do usuário para o qual o evento está sendo processado
   * @param data - Os dados extraídos do texto
   * @returns A mensagem de feedback personalizada para o usuário
   */
  private async handleExpense(user: User, data: GeminiExtraction): Promise<string> {
    await this.transactionRepo.create({
      user_id: user.id,
      amount: data.amount,
      category: data.category,
      type: 'EXPENSE',
      raw_text: "Processado via IA",
      date: new Date(data.date_iso),
      deleted_at: null
    });

    const totalGastoHoje = await this.transactionRepo.getDailyExpenseTotal(user.id);
    const limiteRestante = Number(user.daily_limit) - totalGastoHoje;

    let feedback = `🛒 ${data.category}: R$ ${data.amount.toFixed(2)} registrados!\n`;
    
    if (limiteRestante > 0) {
      feedback += `Restam R$ ${limiteRestante.toFixed(2)} hoje. Mantenha o foco! 🔥`;
    } else {
      feedback += `⚠️ Atenção! Você estourou seu limite diário em R$ ${Math.abs(limiteRestante).toFixed(2)}.\nSua Reserva de Sucesso será acionada hoje à noite para tentar salvar sua ofensiva!`;
    }

    return feedback;
  }
}