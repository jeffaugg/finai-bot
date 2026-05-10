import { z } from 'zod';

export const OnboardingStep = z.enum([
  'not_started',
  'awaiting_salary',
  'awaiting_fixed_expenses',
  'awaiting_saving_pct',
  'awaiting_reminder_pref',
  'completed',
]);

export type OnboardingStep = z.infer<typeof OnboardingStep>;

export interface User {
  id: string;
  telegram_id: number;
  monthly_income: number;
  fixed_expenses: number;
  saving_percentage: number;
  daily_limit: number;
  success_reserve: number;
  current_streak: number;
  max_streak: number;
  snooze_until: Date | null;
  last_closed_date: Date | null;
  created_at: Date;
  onboarding_step: OnboardingStep;
  timezone: string;
  reminders_enabled: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  type: 'EXPENSE' | 'INFLOW';
  raw_text: string;
  date: Date;
  deleted_at: Date | null;
}

export const UserSchema = z.object({
  id: z.uuid(),
  telegram_id: z.coerce.number(),
  monthly_income: z.coerce.number(),
  fixed_expenses: z.coerce.number(),
  saving_percentage: z.coerce.number(),
  daily_limit: z.coerce.number(),
  success_reserve: z.coerce.number(),
  current_streak: z.coerce.number(),
  max_streak: z.coerce.number(),
  snooze_until: z.coerce.date().nullable(),
  last_closed_date: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  onboarding_step: OnboardingStep,
  timezone: z.string(),
  reminders_enabled: z.boolean(),
});

export const TransactionSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  amount: z.coerce.number(),
  category: z.string(),
  type: z.enum(['EXPENSE', 'INFLOW']),
  raw_text: z.string(),
  date: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
});

export const IntentEnum = z.enum(['EXPENSE', 'INFLOW', 'UPDATE_SALARY']);

export const GeminiExtractionSchema = z.object({
  intent: IntentEnum.describe(
    "Classifique a intenção: 'EXPENSE' para gastos, 'INFLOW' para ganhos extras/bônus, 'UPDATE_SALARY' para mudança de renda fixa."
  ),
  amount: z.number().positive().describe(
    "O valor numérico absoluto extraído do texto. Nunca use negativo."
  ),
  category: z.string().describe(
    "A categoria da transação (ex: Alimentação, Transporte, Lazer, Bônus). Retorne 'Salário' se a intenção for UPDATE_SALARY."
  ),
  date_iso: z.string().describe(
    "Data inferida no formato ISO 8601 (ex: '2026-05-03T12:00:00Z'). Use a data atual caso não seja especificado 'ontem' ou outra data."
  )
});

export type GeminiExtraction = z.infer<typeof GeminiExtractionSchema>;

export interface FinancialEventResult {
  message: string;
  transactionId?: string;
}

export const ClassifiedIntent = z.enum([
  'EXPENSE',
  'INFLOW',
  'UPDATE_SALARY',
  'QUERY_SUMMARY',
  'QUERY_LIST',
  'DELETE_BY_DESCRIPTION',
  'HELP',
  'GREETING',
  'OUT_OF_SCOPE',
]);

export type ClassifiedIntent = z.infer<typeof ClassifiedIntent>;

export const ClassificationPeriod = z.enum(['today', 'week', 'month', 'last_month']);
export type ClassificationPeriod = z.infer<typeof ClassificationPeriod>;

export const ClassificationSlots = z
  .object({
    period: ClassificationPeriod.optional(),
    category: z.string().optional(),
    description: z.string().optional(),
  })
  .optional();

export const ClassificationSchema = z.object({
  intent: ClassifiedIntent,
  confidence: z.number().min(0).max(1),
  slots: ClassificationSlots,
});

export type Classification = z.infer<typeof ClassificationSchema>;
