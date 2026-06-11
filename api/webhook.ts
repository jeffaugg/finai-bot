import { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../src/config/clients';
import { setupBotCommands } from '../src/controllers/BotController';
import { isWebhookAuthorized } from '../src/utils/auth';

setupBotCommands();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (
      !isWebhookAuthorized(
        typeof secretToken === 'string' ? secretToken : undefined,
        process.env.TELEGRAM_WEBHOOK_SECRET
      )
    ) {
      return res.status(401).send('Unauthorized');
    }

    try {
      const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log(
        'Webhook update recebido:',
        JSON.stringify({
          update_id: update?.update_id,
          keys: update ? Object.keys(update) : [],
        })
      );

      await bot.handleUpdate(update);

      return res.status(200).send('OK');
    } catch (error) {
      console.error('Erro crítico no processamento do webhook:', error);
      return res.status(200).send('Error Processed');
    }
  } else {
    return res.status(200).send('FinAI Bot Webhook está ativo e operante. 🚀');
  }
}