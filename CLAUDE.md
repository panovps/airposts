# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AirPost — a Telegram bot (NestJS 11 + grammY) that analyzes forwarded messages to extract named entities (person, organization, location, event, sports_club) using LLM with regex fallback. Data is stored in PostgreSQL via TypeORM.

## Commands

```bash
npm run start:dev          # Dev server with auto-restart (ts-node-dev)
npm run build              # Compile TS + copy prompt files to dist/
npm run typecheck          # Type-check without emitting
npm run test               # Run all tests (Jest)
npm run test:watch         # Jest in watch mode
npm run test:cov           # Jest with coverage (src/**/*.service.ts)
npm run migration:run      # Apply pending migrations
npm run migration:generate -- --name=Name  # Auto-generate migration from entity diffs
npm run migration:revert   # Undo last migration
```

Infrastructure: `docker compose up -d` (PostgreSQL 16).

## Required Checks

Always run before completing work:
- `npm run typecheck`
- `npm run build`

If DB entities changed: generate a migration and verify with `npm run migration:run`.

## Architecture

```
src/
├── main.ts              # NestJS bootstrap
├── app.module.ts        # Root module (ConfigModule, TypeOrmModule, BotModule)
├── bot/                 # grammY bot: commands, message handlers, formatting
├── analysis/            # LLM entity extraction (ai-sdk) + regex fallback
│   └── prompts/         # System/user prompt templates (Russian, .md files)
├── entities/            # Entity persistence (replace-per-message pattern)
├── messages/            # Message storage with forward metadata
├── telegram-users/      # User upsert on every update
└── database/            # TypeORM DataSource config + migrations
```

**Module dependency chain:** `AppModule` → `BotModule` → `{TelegramUsersModule, MessagesModule, AnalysisModule, EntitiesModule}`

**Core flow:** Telegram update → upsert user → store message → LLM analysis (fallback to regex on error) → replace entities for message → format & reply in HTML.

## Key Patterns

- **Strict module boundaries** — each feature is a NestJS module exporting its service. Don't break these boundaries.
- **DB schema via migrations only** — `synchronize: false`. Never enable auto-sync. Edit entity files then generate migrations.
- **Entity replacement** — `EntitiesService.replaceForMessage` deletes old entities and inserts new ones per message.
- **User upsert** — conflict on `telegramId`, always updates `lastSeenAt`.
- **LLM provider routing** — `LLM_PROVIDER` env var selects provider (openai/anthropic/deepseek). Model ID from `{PROVIDER}_MODEL` env var. On LLM failure → fallback to regex extraction.
- **Normalization pipeline** — `normalizeDetections()`: trim, deduplicate by type+normalizedValue, compute text offsets, sort by offset.
- **Bot replies** — HTML format with proper escaping (`&amp;`, `&lt;`, `&gt;`). All user-facing text is in Russian.
- **`messages.raw_payload`** — JSONB storing full Telegram payload. Treat as sensitive.

## Environment

Copy `.env.example` to `.env`. Required: `BOT_TOKEN`, `DATABASE_URL`, one LLM provider API key. See `.env.example` for all options.
