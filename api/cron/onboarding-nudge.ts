import { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../../src/config/clients';
import { UserRepository } from '../../src/repositories/UserRepository';

const userRepo = new UserRepository();

const STALE_AFTER_HOURS = 24;

const NUDGE_MESSAGE =
  '👋 Oi! Notei que você começou seu cadastro mas não terminou.\n\n' +
  'Faltam pouquinhas perguntas pra eu calcular seu limite diário e começar a te ajudar.\n' +
  'Manda /start pra continuarmos de onde paramos. 🚀';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const users = await userRepo.findStaleOnboardingForNudge(STALE_AFTER_HOURS);
    const results = { sent: 0, errors: 0, total: users.length };

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegram_id, NUDGE_MESSAGE);
        await userRepo.markOnboardingNudged(user.id);
        results.sent++;
      } catch (err) {
        console.error(`Erro ao enviar nudge para ${user.telegram_id}:`, err);
        results.errors++;
      }
    }

    console.log(
      `Onboarding nudge: ${results.sent}/${results.total} enviados, ${results.errors} erros`
    );
    return res.status(200).json(results);
  } catch (err) {
    console.error('Erro crítico no cron de onboarding-nudge:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
