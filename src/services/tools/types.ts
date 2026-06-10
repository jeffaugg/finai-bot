import { Type, FunctionDeclaration, Schema } from '@google/genai';
import { ClassificationPeriod } from '../../types';
import { CANONICAL_CATEGORIES } from '../../types/constants';

export type AgentAction =
  | { tool: 'registrar_gasto'; amount: number; category: string; dia?: 'hoje' | 'ontem' }
  | { tool: 'registrar_entrada'; amount: number; category: string }
  | { tool: 'atualizar_salario'; amount: number }
  | { tool: 'atualizar_gastos_fixos'; amount: number }
  | { tool: 'atualizar_percentual_poupanca'; percent: number }
  | { tool: 'configurar_lembretes'; ativar: boolean }
  | {
      tool: 'consultar_resumo';
      period?: ClassificationPeriod;
      incluirTransacoes?: boolean;
      incluirComparacao?: boolean;
    }
  | { tool: 'listar_transacoes'; period?: ClassificationPeriod; category?: string }
  | { tool: 'consultar_limite_diario' }
  | { tool: 'consultar_progresso'; incluirLimiteHoje?: boolean }
  | { tool: 'consultar_saldo_mensal'; incluirBreakdown?: boolean }
  | { tool: 'remover_transacao'; description: string }
  | { tool: 'corrigir_ultimo_gasto'; amount: number; category?: string }
  | { tool: 'reportar_lacuna'; intencao: string; motivo: string; sugestao: string }
  | { tool: 'none'; text?: string };

export interface ToolModule {
  declaration: FunctionDeclaration;
  routingHint: string;
  parse(args: Record<string, unknown>): AgentAction | null;
}

export const categoryProp: Schema = {
  type: Type.STRING,
  enum: [...CANONICAL_CATEGORIES],
  description:
    "Categoria GENÉRICA da lista canônica, mapeada semanticamente (ração→Pet, jiu-jitsu→Exercícios, mercado→Alimentação). Use 'Outros' só se nada se aplicar.",
};

export function periodProp(omittedDefault: string): Schema {
  return {
    type: Type.STRING,
    enum: [...ClassificationPeriod.options],
    description: `Período da consulta. Omita para o padrão (${omittedDefault}).`,
  };
}

export function sideloadProp(description: string): Schema {
  return { type: Type.BOOLEAN, description };
}
