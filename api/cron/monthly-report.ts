import { VercelRequest, VercelResponse } from '@vercel/node';
import { bot, supabase } from '../../src/config/clients';
import { TransactionRepository } from '../../src/repositories/TransactionRepository';
import { isCronAuthorized } from '../../src/utils/auth';

const transactionRepo = new TransactionRepository();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  if (!isCronAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = reportDate.getFullYear();
    const month = reportDate.getMonth() + 1;
    const monthName = reportDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    const { data: users } = await supabase
      .from('users')
      .select('*');

    const results = { sent: 0, errors: 0 };

    for (const rawUser of users ?? []) {
      try {
        const summary = await transactionRepo.getMonthlySummary(rawUser.id, year, month);

        if (summary.length === 0) continue;

        const total = summary.reduce((acc, s) => acc + s.total, 0);
        const topCategories = summary
          .slice(0, 5)
          .map((s) => `  • ${s.category}: R$ ${s.total.toFixed(2)}`)
          .join('\n');

        const message =
          `🏆 *Relatório de ${monthName}*\n\n` +
          `💸 Total gasto: R$ ${total.toFixed(2)}\n\n` +
          `*Top categorias:*\n${topCategories}\n\n` +
          `🔥 Sequência atual: ${rawUser.current_streak} dia${rawUser.current_streak !== 1 ? 's' : ''}\n` +
          `🛡️ Reserva de Sucesso: R$ ${Number(rawUser.success_reserve).toFixed(2)}\n\n` +
          `Use /historico para ver os meses anteriores.`;

        await bot.telegram.sendMessage(rawUser.telegram_id, message, { parse_mode: 'Markdown' });
        results.sent++;
      } catch (err) {
        console.error(`Erro ao enviar relatório para ${rawUser.telegram_id}:`, err);
        results.errors++;
      }
    }

    console.log(`Relatórios mensais: ${results.sent} enviados, ${results.errors} erros`);
    return res.status(200).json(results);
  } catch (err) {
    console.error('Erro crítico no cron de relatório mensal:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
