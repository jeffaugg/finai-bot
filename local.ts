import { bot } from './src/config/clients';
import { setupBotCommands } from './src/controllers/BotController';

setupBotCommands();

bot.launch(() => {
  console.log('🤖 FinAI Bot rodando localmente em modo Polling...');
  console.log('Envie uma mensagem no Telegram para testar!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));