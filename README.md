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
| **Function calling** | `AgentService` interpreta a mensagem e escolhe a ferramenta (registrar gasto/entrada, atualizar salário/gastos fixos/poupança, consultar/listar/remover, corrigir último gasto, limite do dia, progresso, saldo do mês, lembretes) em uma única chamada ao Gemini |
| **Múltiplos registros por frase** | "Gastei 20 no uber e 30 no mercado" vira duas transações (todas as function calls são despachadas em sequência) |
| **Anti-alucinação de confirmação** | Histórico em notação de ferramenta + retry forçando tool quando o modelo alega ter registrado sem chamar a ferramenta — confirmação falsa nunca chega ao usuário |
| **Tools com sideloads** | Parâmetros opt-in `incluir_*` enriquecem a resposta sob demanda (resumo + transações/comparação, progresso + limite, saldo + categorias), mantendo o caminho padrão enxuto |
| **Conversa multi-turn** | O agente usa o histórico recente para pedir o que faltar ("gastei no mercado" → "quanto?") e dar coaching reativo após um estouro |
| **Onboarding guiado** | State machine de 5 etapas via `onboarding_step` no banco de dados |
| **Resumo de gastos** | "Quanto gastei hoje/ontem/essa semana/esse mês?" com totais por categoria |
| **Gasto retroativo (ontem)** | "Ontem gastei 25 na padaria" registra com a data de ontem (computada no servidor), sem afetar o limite de hoje |
| **Perfil financeiro editável** | "Minhas contas fixas são 1200" / "quero poupar 30%" atualizam o perfil e recalculam o limite diário |
| **Controle de lembretes no chat** | "Para de me lembrar" / "pode voltar a me lembrar" liga/desliga os lembretes diários |
| **Limite do dia** | "Quanto posso gastar hoje?" responde o limite diário menos o que já foi gasto |
| **Progresso (gamificação)** | "Como tá minha sequência?" mostra streak, reserva de sucesso e limite diário |
| **Saldo do mês** | "Quanto sobrou esse mês?" calcula renda (salário + extras) menos gastos fixos e do mês |
| **Listagem de transações** | "Me mostra meus gastos com lazer" com filtro e paginação |
| **Exclusão conversacional** | "Remove meu último gasto no mercado" com confirmação inline |
| **Confirmação de valor alto** | Gastos a partir de `HIGH_VALUE_THRESHOLD` (R$ 500) pedem confirmação inline antes de gravar |
| **Correção do último gasto** | "Na verdade foi 80" desfaz e recria o último gasto preservando a data, registrando o evento de correção |
| **Captura de lacunas** | Pedidos sobre finanças que nenhuma tool atende viram registro estruturado em `capability_gaps` (via `reportar_lacuna`), em vez de recusa em texto livre |
| **Feedback do usuário** | `/feedback <texto>` grava sugestões livres como insumo qualitativo para a pesquisa |
| **Gamificação com Streaks** | Mantenha gastos abaixo do limite diário para estender a ofensiva |
| **Reserva de Sucesso** | Economia diária acumula como colchão para dias de maior gasto |
| **Lembretes inteligentes** | Cron de lembretes só dispara para usuários sem gasto no dia |
| **Moderação de mensagens** | Saudações e off-topics são respondidos sem acionar a IA |
| **Timezone-aware** | Todas as queries usam horário de Brasília (`America/Sao_Paulo`) |
| **Segurança de propriedade** | `softDelete` valida `user_id` — impossível apagar transação alheia |

> **Nota metodológica (TCC):** a conversa multi-turn é uma **variável** do experimento. A retenção observada pode resultar da gamificação, da conversação ou da combinação das duas — a discussão de ameaças à validade deve reconhecer essa atribuição.

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

Uma mensagem de texto passa por um *gate* de onboarding, moderação pré-IA, uma **única** chamada ao Gemini com *function calling* e o roteamento da tool escolhida para o handler de domínio:

```mermaid
flowchart TD
    TG(["📩 Telegram update (webhook)"]) --> BC["BotController · bot.on('text')"]
    BC --> OG{"onboarding_step<br/>= 'completed'?"}
    OG -->|"não"| OH["🧭 OnboardingHandler.continue<br/>(state machine · 5 etapas)"]
    OG -->|"sim"| MOD{"1 · ModerationService.preCheck"}
    MOD -->|"saudação / off-topic / curto"| CANNED["💬 Resposta pronta<br/>(sem chamar IA)"]
    MOD -->|"passa"| AG["2 · AgentService.interpret<br/>— 1 chamada Gemini (function calling) —<br/>+ janela recente (ConversationRepository)"]
    AG --> ZOD["Valida response.functionCalls com Zod<br/>→ AgentAction"]
    ZOD --> ROUTER{"3 · AgentRouter.dispatch"}

    ROUTER -->|"registrar_gasto / registrar_entrada / atualizar_salario"| EXP["💳 ExpenseHandler.handle"]
    EXP --> HV{"valor ≥ HIGH_VALUE_THRESHOLD?"}
    HV -->|"sim"| CONF["⚠️ Confirmação inline<br/>antes de gravar"]
    HV -->|"não"| GAM["GamificationService<br/>.processFinancialEvent"]
    CONF -->|"confirma"| GAM

    ROUTER -->|"corrigir_ultimo_gasto"| CORR["✏️ ExpenseHandler.correctLast<br/>→ correctLastExpense (desfaz + recria)"]
    ROUTER -->|"consultar_resumo"| QS["📊 QueryHandler.summary"]
    ROUTER -->|"listar_transacoes"| QL["📋 QueryHandler.list"]
    ROUTER -->|"remover_transacao"| QD["🗑️ QueryHandler.deleteByDescription<br/>(confirmação inline)"]
    ROUTER -->|"none + texto"| FU["💬 Follow-up multi-turn<br/>(responde o texto do modelo)"]
    ROUTER -->|"none (sem texto)"| ST["👋 SmallTalkHandler.help"]

    GAM --> DB[("Supabase<br/>transactions · user_events · daily_snapshots")]
    CORR --> DB

    classDef ai fill:#d1ecf1,stroke:#17a2b8,color:#000;
    classDef gate fill:#fff3cd,stroke:#ffc107,color:#000;
    classDef canned fill:#f0f0f0,stroke:#999,color:#000;
    classDef domain fill:#d4edda,stroke:#28a745,color:#000;
    class AG ai;
    class OG,MOD,ROUTER,HV gate;
    class CANNED,FU,ST,OH canned;
    class GAM,CORR,DB domain;
```

### Estrutura de Diretórios

```
finai-bot/
├── api/
│   ├── webhook.ts          
│   └── cron/               
├── docs/
│   └── PROGRESSO.md        
├── scripts/
│   └── migrate.ts          
├── src/
│   ├── config/
│   ├── controllers/
│   ├── handlers/
│   ├── repositories/       
│   ├── services/
│   │   └── tools/          # tools do agente, agrupadas por domínio
│   ├── types/
│   └── utils/              
├── supabase/migrations/
└── tests/unit/
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
| `TELEGRAM_WEBHOOK_SECRET` | *(opcional)* secret_token do webhook; se definido, é validado no header `x-telegram-bot-api-secret-token` | `um-valor-aleatório` |
| `CRON_SECRET` | *(opcional)* protege os endpoints `/api/cron/*`; a Vercel envia `Authorization: Bearer <CRON_SECRET>` | `um-valor-aleatório` |

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

- **`DateService`** — bounds de dia/semana/mês, DST-safe, virada de mês, helpers de data local, período anterior (comparação)
- **`ModerationService`** — heurísticas de saudação, comprimento, off-topic
- **`AgentService`** — function calling do Gemini: mapeia cada tool (incl. sideloads e `reportar_lacuna`), valida args com Zod, fallback para `none`
- **`AgentRouter`** — despacho correto de cada tool para o handler (incl. limite/progresso/saldo e captura de lacuna)
- **`ExpenseHandler`** — confirmação de valor alto e correção do último gasto
- **`GamificationService`** — fechamento diário (3 desfechos, idempotência, dias pulados), emissão de eventos, correção e status
- **`OnboardingHandler`** — todas as 5 transições de estado
- **`QueryHandler`** — resumo (com sideloads), listagem, exclusão, limite do dia, progresso, saldo mensal
- **Repositórios** — `EventRepository` (append-only best-effort), `SnapshotRepository` (idempotência por data), `ConversationRepository` (janela recente), `FeedbackRepository`, `CapabilityGapRepository` (captura de lacunas best-effort)
- **`retry` / `auth`** — backoff exponencial do `withRetry` e autorização de webhook/cron
- **`parse`** — parseAmount e parsePercentage com variantes BR

### Integração Contínua

Cada pull request aciona automaticamente o workflow `.github/workflows/ci.yml`, que instala as dependências e executa `pnpm test`. O merge só é liberado se todos os testes passarem.

---

## Cron

Os agendamentos da Vercel rodam em **UTC**; abaixo, a coluna "Horário (SP)" mostra o horário local pretendido (`America/Sao_Paulo`, UTC−3).

| Endpoint | Cron (UTC) | Horário (SP) | Descrição |
|---|---|---|---|
| `/api/cron/reminder` | `0 2 * * *` | 23:00 | Lembrete para usuários sem gasto no dia |
| `/api/cron/daily-close` | `59 2 * * *` | 23:59 | Fechamento do dia (streaks e reserva) |
| `/api/cron/monthly-report` | `0 11 1 * *` | 08:00 (dia 1) | Relatório do mês anterior |
| `/api/cron/onboarding-nudge` | `0 0 * * *` | 21:00 | Reengajamento de onboardings incompletos |

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

