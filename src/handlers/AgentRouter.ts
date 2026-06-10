import { Context } from 'telegraf';
import { CapabilityGapRepository } from '../repositories/CapabilityGapRepository';
import { EventRepository } from '../repositories/EventRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AgentAction } from '../services/AgentService';
import { DateService } from '../services/DateService';
import { Classification, User } from '../types';
import { ExpenseHandler } from './ExpenseHandler';
import { QueryHandler } from './QueryHandler';
import { SmallTalkHandler } from './SmallTalkHandler';

const dateService = new DateService();

export class AgentRouter {
  constructor(
    private readonly expenseHandler: ExpenseHandler,
    private readonly queryHandler: QueryHandler,
    private readonly smallTalkHandler: SmallTalkHandler,
    private readonly capabilityGapRepo?: CapabilityGapRepository,
    private readonly userRepo?: UserRepository,
    private readonly eventRepo?: EventRepository
  ) {}

  async dispatch(ctx: Context, user: User, action: AgentAction, rawText: string): Promise<void> {
    switch (action.tool) {
      case 'registrar_gasto': {
        const date =
          action.dia === 'ontem'
            ? dateService.getLocalNoon(dateService.addDays(dateService.getCurrentLocalDateString(), -1))
            : undefined;
        return this.expenseHandler.handle(
          ctx,
          user,
          { intent: 'EXPENSE', amount: action.amount, category: action.category, date },
          rawText
        );
      }

      case 'registrar_entrada':
        return this.expenseHandler.handle(
          ctx,
          user,
          { intent: 'INFLOW', amount: action.amount, category: action.category },
          rawText
        );

      case 'atualizar_salario':
        return this.expenseHandler.handle(
          ctx,
          user,
          { intent: 'UPDATE_SALARY', amount: action.amount, category: 'Salário' },
          rawText
        );

      case 'atualizar_gastos_fixos':
        return this.expenseHandler.updateFixedExpenses(ctx, user, action.amount);

      case 'atualizar_percentual_poupanca':
        return this.expenseHandler.updateSavingPercentage(ctx, user, action.percent);

      case 'configurar_lembretes': {
        if (!this.userRepo) {
          return this.smallTalkHandler.help(ctx);
        }
        await this.userRepo.updateUser(user.id, { reminders_enabled: action.ativar });
        await this.eventRepo?.record(user.id, 'reminders_toggled', { enabled: action.ativar });
        await ctx.reply(
          action.ativar
            ? '🔔 Lembretes ativados! Vou te lembrar de registrar seus gastos.'
            : '🔕 Lembretes desativados. Quando quiser, é só pedir pra eu voltar a te lembrar.'
        );
        return;
      }

      case 'consultar_resumo':
        return this.queryHandler.summary(
          ctx,
          user,
          clf('QUERY_SUMMARY', { period: action.period }),
          { incluirTransacoes: action.incluirTransacoes, incluirComparacao: action.incluirComparacao }
        );

      case 'listar_transacoes':
        return this.queryHandler.list(
          ctx,
          user,
          clf('QUERY_LIST', { period: action.period, category: action.category })
        );

      case 'consultar_limite_diario':
        return this.queryHandler.dailyBudget(ctx, user);

      case 'consultar_progresso':
        return this.queryHandler.progress(ctx, user, action.incluirLimiteHoje);

      case 'consultar_saldo_mensal':
        return this.queryHandler.monthlyBalance(ctx, user, action.incluirBreakdown);

      case 'remover_transacao':
        return this.queryHandler.deleteByDescription(
          ctx,
          user,
          clf('DELETE_BY_DESCRIPTION', { description: action.description })
        );

      case 'corrigir_ultimo_gasto':
        return this.expenseHandler.correctLast(ctx, user, action.amount, action.category);

      case 'reportar_lacuna':
        await this.capabilityGapRepo?.record(user.id, {
          inputText: rawText,
          intent: action.intencao,
          reason: action.motivo,
          suggestion: action.sugestao,
        });
        await ctx.reply(
          '🤔 Ainda não sei fazer isso, mas registrei seu pedido pra evoluir. ' +
            'Por ora posso te ajudar com gastos, ganhos, resumos, seu limite do dia e seu progresso.'
        );
        return;

      case 'none':
        if (action.text) {
          await ctx.reply(action.text);
          return;
        }
        return this.smallTalkHandler.help(ctx);
    }
  }
}

function clf(intent: Classification['intent'], slots: Classification['slots']): Classification {
  return { intent, confidence: 1, slots };
}
