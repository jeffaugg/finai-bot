import { createClient } from '@supabase/supabase-js';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente obrigatória não definida: ${key}`);
  return value;
}

export const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_KEY')
);

export const ai = new GoogleGenAI({
  apiKey: requireEnv('GEMINI_API_KEY'),
});

export const bot = new Telegraf(requireEnv('TELEGRAM_BOT_TOKEN'));
