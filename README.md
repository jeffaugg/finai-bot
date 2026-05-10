# FinAI — Assistente Financeiro Conversacional via Telegram

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-43853D?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-8E75B2?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)

</div>

<br/>

**FinAI** é um bot de Telegram que age como um assistente financeiro pessoal. Em vez de formulários, o usuário simplesmente envia mensagens em linguagem natural — *"gastei 40 no mercado"*, *"recebi 200 de bônus"* — e o bot extrai, categoriza e contabiliza automaticamente usando Google Gemini. Um sistema de gamificação com streaks e reserva de sucesso incentiva a consistência diária.

> **Contexto Acadêmico:** Este projeto é desenvolvido como Trabalho de Conclusão de Curso (TCC) em Engenharia de Software na **UFC — Campus Quixadá**, avaliando o impacto de IA e Gamificação (Economia Comportamental) na retenção de hábitos de educação financeira.

---

## Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| **Extração via NLP** | Detecta gastos, entradas e atualizações de salário a partir de texto livre |
| **Pipeline dupla de IA** | ClassificationService classifica a intenção; ExtractionService extrai dados financeiros |
| **Onboarding guiado** | State machine de 5 etapas via `onboarding_step` no banco de dados |
| **Resumo de gastos** | "Quanto gastei hoje/essa semana/esse mês?" com totais por categoria |
| **Listagem de transações** | "Me mostra meus gastos com lazer" com filtro e paginação |
| **Exclusão conversacional** | "Remove meu último gasto no mercado" com confirmação inline |
| **Gamificação com Streaks** | Mantenha gastos abaixo do limite diário para estender a ofensiva |
| **Reserva de Sucesso** | Economia diária acumula como colchão para dias de maior gasto |
| **Lembretes inteligentes** | Cron de lembretes só dispara para usuários sem gasto no dia |
| **Moderação de mensagens** | Saudações e off-topics são respondidos sem acionar a IA |
| **Timezone-aware** | Todas as queries usam horário de Brasília (`America/Sao_Paulo`) |
| **Segurança de propriedade** | `softDelete` valida `user_id` — impossível apagar transação alheia |

---

## Arquitetura

### Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 5.x (strict) |
| Bot Framework | Telegraf 4.x (webhook via Vercel) |
| IA / NLP | Google Gemini 2.5 Flash (`@google/genai`) |
| Banco de Dados | PostgreSQL via Supabase (`@supabase/supabase-js`) |
| Validação de Schema | Zod 4.x |
| Serverless & Crons | Vercel Functions + Vercel Cron |
| Testes | Vitest |
| Migrations | Script próprio (`scripts/migrate.ts`) via `pg` |

### Fluxo Conversacional

![Fluxo de processamento de mensagens do FinAI](docs/assets/fluxo.drawio.svg)

### Estrutura de Diretórios

```
finai-bot/
├── api/
│   ├── webhook.ts          # Entry point do webhook Telegram
│   └── cron/               # Jobs agendados (reminder, daily-close, monthly-report, onboarding-nudge)
├── docs/assets/            # Diagramas e assets de documentação
├── scripts/
│   └── migrate.ts          # Runner de migrations SQL (idempotente)
├── src/
│   ├── config/             # Clients: Supabase, Telegraf, Gemini
│   ├── controllers/        # BotController — pipeline de roteamento
│   ├── handlers/           # Um handler por fluxo: Onboarding, Intent, Expense, Query, SmallTalk
│   ├── repositories/       # UserRepository, TransactionRepository
│   ├── services/           # Classification, Date, Extraction, Gamification, Moderation
│   ├── types/              # Zod schemas, enums, erros customizados
│   └── utils/              # parseAmount, parsePercentage
├── supabase/migrations/    # SQL versionado (0001_init → 0003_onboarding_nudge)
└── tests/unit/             # Testes Vitest (8 arquivos, 58 casos)
```

---

## Primeiros Passos

### Pré-requisitos

- **Node.js** ≥ 18
- **pnpm** ≥ 9 (`npm i -g pnpm`)
- Contas em: [Telegram BotFather](https://t.me/BotFather), [Supabase](https://supabase.com/), [Google AI Studio](https://aistudio.google.com/)

### 1. Clonar e instalar

```bash
git clone https://github.com/jeffaugg/finai-bot.git
cd finai-bot
pnpm install
```

### 2. Configurar variáveis de ambiente

Copie o exemplo e preencha com suas credenciais:

```bash
cp .env.example .env
```

| Variável | Descrição | Exemplo |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token gerado pelo BotFather | `123456:ABC-DEF...` |
| `SUPABASE_URL` | URL do projeto Supabase | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Chave `service_role` do Supabase (nunca exponha no cliente) | `eyJ...` |
| `GEMINI_API_KEY` | Chave do Google AI Studio | `AIza...` |
| `DATABASE_URL` | URL de conexão direta ao PostgreSQL (para migrations) | `postgresql://postgres:senha@db.xyz.supabase.co:5432/postgres` |

> **Atenção:** `SUPABASE_SERVICE_KEY` e `DATABASE_URL` contêm credenciais de alto privilégio. Nunca as inclua em commits ou logs.

### 3. Aplicar migrations

```bash
pnpm migrate
```

O runner lê todos os arquivos `.sql` em `supabase/migrations/` em ordem alfabética e registra cada migration na tabela `_migrations` — execuções repetidas são seguras (idempotente).

Se a senha do banco contiver caracteres especiais (e.g., `#`, `@`), encode com `%23`, `%40` na URL.

### 4. Executar localmente (modo polling)

```bash
pnpm start
```

O arquivo `local.ts` inicia o bot em modo long-polling (sem webhook), ideal para desenvolvimento e testes manuais no Telegram.

---

## Scripts Disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `start` | `pnpm start` | Inicia o bot em modo polling (`local.ts`) |
| `test` | `pnpm test` | Executa todos os testes unitários (uma vez) |
| `test:watch` | `pnpm test:watch` | Executa testes em modo watch |
| `test:coverage` | `pnpm test:coverage` | Gera relatório de cobertura (`coverage/`) |
| `migrate` | `pnpm migrate` | Aplica migrations pendentes no banco de dados |

---

## Testes

O projeto usa [Vitest](https://vitest.dev/) para testes unitários. Todos os serviços externos (Gemini, Supabase, Telegraf) são mockados — nenhuma chamada de rede é feita durante os testes.

```bash
# Rodar todos os testes
pnpm test

# Modo watch (re-executa ao salvar)
pnpm test:watch

# Relatório de cobertura (HTML em coverage/)
pnpm test:coverage
```

### Estrutura de testes

Os testes unitários ficam em `tests/unit/` e cobrem:

- **`DateService`** — bounds de dia/semana/mês, DST-safe, virada de mês
- **`ModerationService`** — heurísticas de saudação, comprimento, off-topic
- **`ClassificationService`** — parsing de JSON do Gemini, fallback para OUT_OF_SCOPE
- **`OnboardingHandler`** — todas as 5 transições de estado
- **`QueryHandler`** — resumo, listagem, exclusão por descrição
- **`IntentRouter`** — despacho correto por intent
- **`parse`** — parseAmount e parsePercentage com variantes BR

### Integração Contínua

Cada pull request aciona automaticamente o workflow `.github/workflows/ci.yml`, que instala as dependências e executa `pnpm test`. O merge só é liberado se todos os testes passarem.

---

## Cron

| Endpoint | Cron | Descrição |
|---|---|---|
| `/api/cron/reminder` | `0 23 * * *` | Lembrete para usuários sem gasto no dia |
| `/api/cron/daily-close` | `59 23 * * *` | Fechamento do dia (streaks e reserva) |
| `/api/cron/monthly-report` | `0 8 1 * *` | Relatório do mês anterior |
| `/api/cron/onboarding-nudge` | `0 21 * * *` | Reengajamento de onboardings incompletos |

---

## Migrations

As migrations ficam em `supabase/migrations/` e seguem a convenção `NNNN_descricao.sql`.

```bash
# Aplicar todas as migrations pendentes
pnpm migrate
```

O runner (`scripts/migrate.ts`) cria automaticamente a tabela `_migrations` no banco se ela ainda não existir, e cada arquivo é executado em uma transação separada — em caso de falha, o arquivo inteiro é revertido.

Para criar uma nova migration:

```bash
# Nomeie com o próximo número sequencial
touch supabase/migrations/0004_minha_alteracao.sql
# Edite o arquivo e execute
pnpm migrate
```

---

## Compatibilidade com a Base Existente

A migration `0002_add_onboarding.sql` inclui:

```sql
UPDATE users SET onboarding_step = 'completed' WHERE monthly_income > 0;
```

Usuários já cadastrados com salário configurado não são obrigados a refazer o onboarding. Todas as migrations são escritas com `IF NOT EXISTS` / `IF NOT EXISTS constraint` para serem reaplicáveis sem erros.

---

## Contribuindo

1. Faça um fork e crie um branch descritivo: `git checkout -b feat/meu-recurso`
2. Escreva ou atualize testes para a mudança: `pnpm test:watch`
3. Certifique-se que `tsc --noEmit` passa sem erros
4. Abra um Pull Request — o CI rodará os testes automaticamente antes do merge

### Convenções de Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adiciona suporte a voz
fix: corrige timezone no fechamento diário
refactor: extrai lógica de parsing para utils/parse.ts
test: cobre transições de onboarding
```

---

## Licença

ISC © [Jeferson Augusto](https://github.com/jeffaugg)

