import { Context } from 'telegraf';
import { GREETING_RESPONSE, HELP_RESPONSE, OFF_TOPIC_RESPONSE } from '../types/constants';

export class SmallTalkHandler {
  async greet(ctx: Context): Promise<void> {
    await ctx.reply(GREETING_RESPONSE);
  }

  async help(ctx: Context): Promise<void> {
    await ctx.reply(HELP_RESPONSE, { parse_mode: 'Markdown' });
  }

  async outOfScope(ctx: Context): Promise<void> {
    await ctx.reply(OFF_TOPIC_RESPONSE);
  }
}
