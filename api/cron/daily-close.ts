import { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../../src/config/clients';
import { UserRepository } from '../../src/repositories/UserRepository';
import { TransactionRepository } from '../../src/repositories/TransactionRepository';
import { GamificationService } from '../../src/services/GamificationService';

const userRepo = new UserRepository();
const transactionRepo = new TransactionRepository();
const gamificationService = new GamificationService(userRepo, transactionRepo);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const users = await userRepo.findAllActiveUsers();
    const results = { success: 0, errors: 0 };

    for (const user of users) {
      try {
        const message = await gamificationService.closeDailyAccount(user);
        await bot.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
        results.success++;
      } catch (err) {
        console.error(`Erro ao fechar dia do usuário ${user.telegram_id}:`, err);
        results.errors++;
      }
    }

    console.log(`Fechamento diário: ${results.success} OK, ${results.errors} erros`);
    return res.status(200).json(results);
  } catch (err) {
    console.error('Erro crítico no fechamento diário:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
