import { VercelRequest, VercelResponse } from '@vercel/node';
import { Markup } from 'telegraf';
import { bot } from '../../src/config/clients';
import { UserRepository } from '../../src/repositories/UserRepository';
import { EventRepository } from '../../src/repositories/EventRepository';

const userRepo = new UserRepository();
const eventRepo = new EventRepository();

const REMINDER_MESSAGE =
  '📢 Ei! Você ainda não registrou nenhum gasto hoje.\n' +
  'Manter o registro em dia garante sua sequência! 🔥';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const users = await userRepo.findUsersWithoutTodayExpenses();
    const results = { sent: 0, errors: 0 };

    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback('✅ Já registrei tudo', 'reminder_done'),
      Markup.button.callback('⏰ Lembrar em 1h', 'reminder_snooze'),
    ]);

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegram_id, REMINDER_MESSAGE, keyboard);
        await eventRepo.record(user.id, 'reminder_sent');
        results.sent++;
      } catch (err) {
        console.error(`Erro ao enviar lembrete para ${user.telegram_id}:`, err);
        results.errors++;
      }
    }

    console.log(`Lembretes: ${results.sent} enviados, ${results.errors} erros`);
    return res.status(200).json(results);
  } catch (err) {
    console.error('Erro crítico no cron de lembretes:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
