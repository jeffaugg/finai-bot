import { Context, Markup } from 'telegraf';
import { EventRepository } from '../repositories/EventRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { DateService } from '../services/DateService';
import { Classification, ClassificationPeriod, User } from '../types';
import { TIMEZONE } from '../types/constants';

const LIST_LIMIT = 15;
const DELETE_CANDIDATES_LIMIT = 5;

interface PeriodResolution {
  start: Date;
  end: Date;
  label: string;
}

export class QueryHandler {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly eventRepo?: EventRepository,
    private readonly dateService: DateService = new DateService()
  ) {}

  async summary(ctx: Context, user: User, classification: Classification): Promise<void> {
    const period = classification.slots?.period ?? 'today';
    const { start, end, label } = this.resolvePeriod(period);

    await this.eventRepo?.record(user.id, 'summary_queried', { period });

    const summary = await this.transactionRepo.getCategorySummary(user.id, start, end);

    if (summary.length === 0) {
      await ctx.reply(`📊 Sem gastos registrados ${label}.`);
      return;
    }

    const total = summary.reduce((acc, s) => acc + s.total, 0);
    let msg = `📊 *Resumo ${label}*\nTotal: R$ ${total.toFixed(2)}\n`;
    for (const { category, total: t } of summary.slice(0, 8)) {
      msg += `  • ${category}: R$ ${t.toFixed(2)}\n`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  async list(ctx: Context, user: User, classification: Classification): Promise<void> {
    const period = classification.slots?.period ?? 'month';
    const category = classification.slots?.category;
    const { start, end, label } = this.resolvePeriod(period);

    const txs = await this.transactionRepo.listByPeriod(user.id, {
      start,
      end,
      category,
      limit: LIST_LIMIT + 1,
    });

    if (txs.length === 0) {
      const filterText = category ? ` com "${category}"` : '';
      await ctx.reply(`📋 Sem gastos${filterText} ${label}.`);
      return;
    }

    const truncated = txs.length > LIST_LIMIT;
    const visible = truncated ? txs.slice(0, LIST_LIMIT) : txs;

    const filterText = category ? ` com "${category}"` : '';
    let msg = `📋 *Gastos${filterText} ${label}:*\n`;
    for (const tx of visible) {
      const dateStr = this.dateService.formatDate(tx.date);
      msg += `  • ${dateStr} — ${tx.category}: R$ ${tx.amount.toFixed(2)}\n`;
    }
    if (truncated) {
      msg += `\n_Mostrando os últimos ${LIST_LIMIT}. Use /historico para ver mais._`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  async deleteByDescription(
    ctx: Context,
    user: User,
    classification: Classification
  ): Promise<void> {
    const description = classification.slots?.description?.trim();
    if (!description) {
      await ctx.reply('🤔 Não entendi qual gasto remover. Pode ser mais específico?');
      return;
    }

    const candidates = await this.transactionRepo.findRecentByDescription(
      user.id,
      description,
      DELETE_CANDIDATES_LIMIT
    );

    if (candidates.length === 0) {
      await ctx.reply(`🔍 Não encontrei gastos com "${description}".`);
      return;
    }

    if (candidates.length === 1) {
      const tx = candidates[0];
      const dateStr = this.dateService.formatDate(tx.date);
      await ctx.reply(
        `Quer remover este gasto?\n${dateStr} — ${tx.category}: R$ ${tx.amount.toFixed(2)}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Confirmar', `confirm_delete:${tx.id}`),
            Markup.button.callback('❌ Cancelar', 'cancel_delete'),
          ],
        ])
      );
      return;
    }

    const buttons = candidates.map((tx) => {
      const dateStr = this.dateService.formatDate(tx.date);
      const label = `${dateStr} — ${tx.category}: R$ ${tx.amount.toFixed(2)}`;
      return [Markup.button.callback(label, `confirm_delete:${tx.id}`)];
    });
    buttons.push([Markup.button.callback('❌ Cancelar', 'cancel_delete')]);

    await ctx.reply(
      `Encontrei ${candidates.length} gastos parecidos. Qual você quer remover?`,
      Markup.inlineKeyboard(buttons)
    );
  }

  private resolvePeriod(period: ClassificationPeriod): PeriodResolution {
    const timezone = TIMEZONE;
    const now = new Date();
    switch (period) {
      case 'today': {
        const { start, end } = this.dateService.getDayBounds(timezone, now);
        return { start, end, label: 'hoje' };
      }
      case 'week': {
        const { start, end } = this.dateService.getWeekBounds(timezone, now);
        return { start, end, label: 'nos últimos 7 dias' };
      }
      case 'month': {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
        }).formatToParts(now);
        const year = Number(parts.find((p) => p.type === 'year')!.value);
        const month = Number(parts.find((p) => p.type === 'month')!.value);
        const { start, end } = this.dateService.getMonthBounds(year, month, timezone);
        return { start, end, label: 'neste mês' };
      }
      case 'last_month': {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
        }).formatToParts(now);
        const year = Number(parts.find((p) => p.type === 'year')!.value);
        const month = Number(parts.find((p) => p.type === 'month')!.value);
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonth = month === 1 ? 12 : month - 1;
        const { start, end } = this.dateService.getMonthBounds(prevYear, prevMonth, timezone);
        return { start, end, label: 'no mês passado' };
      }
    }
  }
}
