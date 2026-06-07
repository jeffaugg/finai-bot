import { FunctionDeclaration } from '@google/genai';
import { AgentAction, ToolModule } from './types';
import { registrosTools } from './registros';
import { consultasTools } from './consultas';
import { gerenciamentoTools } from './gerenciamento';
import { sistemaTools } from './sistema';

export type { AgentAction, ToolModule } from './types';

const TOOL_MODULES: ToolModule[] = [
  ...registrosTools,
  ...consultasTools,
  ...gerenciamentoTools,
  ...sistemaTools,
];

const REGISTRY = new Map(TOOL_MODULES.map((m) => [m.declaration.name, m]));

export const TOOL_DECLARATIONS: FunctionDeclaration[] = TOOL_MODULES.map((m) => m.declaration);

export const ROUTING_HINTS: string = TOOL_MODULES.map((m) => m.routingHint).join('\n');

export function parseCall(name: string, args: Record<string, unknown>): AgentAction {
  return REGISTRY.get(name)?.parse(args) ?? { tool: 'none' };
}
