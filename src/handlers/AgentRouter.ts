import { Context } from 'telegraf';
import { AgentAction } from '../services/AgentService';
import { Classification, User } from '../types';
import { ExpenseHandler } from './ExpenseHandler';
import { QueryHandler } from './QueryHandler';
import { SmallTalkHandler } from './SmallTalkHandler';

export class AgentRouter {
  constructor(
    private readonly expenseHandler: ExpenseHandler,
    private readonly queryHandler: QueryHandler,
    private readonly smallTalkHandler: SmallTalkHandler
  ) {}

  async dispatch(ctx: Context, user: User, action: AgentAction, rawText: string): Promise<void> {
    switch (action.tool) {
      case 'registrar_gasto':
        return this.expenseHandler.handle(
          ctx,
          user,
          { intent: 'EXPENSE', amount: action.amount, category: action.category },
          rawText
        );

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

      case 'consultar_resumo':
        return this.queryHandler.summary(
          ctx,
          user,
          clf('QUERY_SUMMARY', { period: action.period })
        );

      case 'listar_transacoes':
        return this.queryHandler.list(
          ctx,
          user,
          clf('QUERY_LIST', { period: action.period, category: action.category })
        );

      case 'remover_transacao':
        return this.queryHandler.deleteByDescription(
          ctx,
          user,
          clf('DELETE_BY_DESCRIPTION', { description: action.description })
        );

      case 'none':
        return this.smallTalkHandler.help(ctx);
    }
  }
}

function clf(intent: Classification['intent'], slots: Classification['slots']): Classification {
  return { intent, confidence: 1, slots };
}
