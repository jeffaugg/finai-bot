import { Context } from 'telegraf';
import { Classification, User } from '../types';
import { QUERY_NOT_IMPLEMENTED_RESPONSE } from '../types/constants';

export class QueryHandler {
  async handle(ctx: Context, _user: User, _classification: Classification): Promise<void> {
    await ctx.reply(QUERY_NOT_IMPLEMENTED_RESPONSE);
  }
}
