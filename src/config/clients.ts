import { createClient } from '@supabase/supabase-js';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY! 
});

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);