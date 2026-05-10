import { Context } from 'telegraf';
import { Classification, User } from '../types';
import { ExpenseHandler } from './ExpenseHandler';
import { QueryHandler } from './QueryHandler';
import { SmallTalkHandler } from './SmallTalkHandler';

export class IntentRouter {
  constructor(
    private readonly expenseHandler: ExpenseHandler,
    private readonly queryHandler: QueryHandler,
    private readonly smallTalkHandler: SmallTalkHandler
  ) {}

  async dispatch(
    ctx: Context,
    user: User,
    text: string,
    classification: Classification
  ): Promise<void> {
    switch (classification.intent) {
      case 'EXPENSE':
      case 'INFLOW':
      case 'UPDATE_SALARY':
        return this.expenseHandler.handle(ctx, user, text);

      case 'QUERY_SUMMARY':
        return this.queryHandler.summary(ctx, user, classification);

      case 'QUERY_LIST':
        return this.queryHandler.list(ctx, user, classification);

      case 'DELETE_BY_DESCRIPTION':
        return this.queryHandler.deleteByDescription(ctx, user, classification);

      case 'HELP':
        return this.smallTalkHandler.help(ctx);

      case 'GREETING':
        return this.smallTalkHandler.greet(ctx);

      case 'OUT_OF_SCOPE':
        return this.smallTalkHandler.outOfScope(ctx);
    }
  }
}
