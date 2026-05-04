# 🤖 FinAI - Educação Financeira Gamificada via Telegram

<div align="center">
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="NodeJS" />
    <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini" />
</div>

<br/>

> **Nota Acadêmica:** Este projeto é desenvolvido como Trabalho de Conclusão de Curso (TCC) em Engenharia de Software na **UFC - Campus Quixadá**, focado em avaliar o impacto da Inteligência Artificial e Gamificação (Economia Comportamental) na retenção de hábitos de educação financeira.

## 📖 Sobre o Projeto

O **FinAI** é um bot de interface conversacional no Telegram que atua como um assistente financeiro inteligente e proativo. Diferente de aplicativos tradicionais de controle financeiro que exigem preenchimento manual de formulários, o FinAI utiliza Processamento de Linguagem Natural (Google Gemini) para extrair, categorizar e contabilizar despesas enviadas em texto livre, áudio ou imagens.

Para combater o abandono do controle financeiro, o sistema utiliza o conceito de **"Ofensivas" (Streaks)** e **"Reserva de Sucesso"**, punindo a inatividade e recompensando a economia diária.

## ✨ Funcionalidades Principais

* **Extração via IA:** Envie textos como *"Gastei 50 no mercado"* e o bot automaticamente extrairá o valor e a categoria.
* **Intenções Inteligentes:** O motor de NLP diferencia Gastos (`EXPENSE`), Bônus Extra (`INFLOW`) e Atualizações de Salário (`UPDATE_SALARY`).
* **Gamificação Baseada em Ofensivas:** Mantenha os gastos abaixo da sua meta diária calculada para estender sua ofensiva.
* **Reserva de Sucesso:** O excedente economizado no dia é guardado em um "colchão" virtual para te proteger em dias de gastos maiores.
* **Onboarding Dinâmico:** Cadastro de limites diretamente pelo chat (`/start`).

## 🏛️ Arquitetura e Tech Stack

O backend foi projetado utilizando princípios de **Domain-Driven Design (DDD)** simplificado e hospedado em uma arquitetura **Serverless** para redução de custos.

* **Linguagem Base:** TypeScript estrito para segurança em tempo de compilação (*Fail-Fast*).
* **Interface Conversacional:** [Telegraf](https://telegraf.js.org/) manipulando requisições via Webhooks.
* **Motor Cognitivo (IA):** API Oficial do Google Gemini (`@google/genai`) utilizando *Structured Outputs* com validação **Zod**.
* **Banco de Dados e ORM:** PostgreSQL hospedado no [Supabase](https://supabase.com/), acessado via `@supabase/supabase-js`.
* **Deploy e Nuvem:** Infraestrutura *Serverless* gerida pela [Vercel](https://vercel.com/).

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
* Node.js (v18 ou superior)
* Gerenciador de Pacotes (NPM, Yarn ou PNPM)
* Contas criadas no Telegram, Supabase e Google AI Studio.

### Passo 1: Clonar e Instalar

```bash
# Clone o repositório
git clone https://github.com/SEU_USUARIO/finai-bot.git
cd finai-bot

# Instale as dependências
pnpm install
```

### Passo 2: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto e preencha com as suas credenciais:

```env
TELEGRAM_BOT_TOKEN="SEU_TOKEN_DO_BOTFATHER"
SUPABASE_URL="URL_DO_SEU_PROJETO_SUPABASE"
SUPABASE_SERVICE_KEY="CHAVE_PRIVADA_SERVICE_ROLE_DO_SUPABASE"
GEMINI_API_KEY="CHAVE_DO_GOOGLE_AI_STUDIO"
```

### Passo 3: Executar (Modo de Teste)

Para testar o bot rodando no seu próprio terminal antes de enviar para a nuvem:

```bash
pnpm start
```

## 👨‍💻 Autoria

Desenvolvido por Jeferson Augusto para validação de pesquisa acadêmica em Engenharia de Software.