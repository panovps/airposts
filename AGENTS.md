# AGENTS.md

## Project Summary
- Stack: NestJS 11, grammY, TypeORM, PostgreSQL.
- Entry point: `src/main.ts`.
- Bot logic: `src/bot/bot.service.ts`.
- DB schema is managed by TypeORM migrations (`src/database/migrations`), not by `synchronize`.

## Local Setup
1. Copy `.env.example` to `.env` and fill `BOT_TOKEN` + provider API key.
2. Start PostgreSQL: `docker compose up -d`.
3. Apply migrations: `npm run migration:run`.
4. Run dev mode: `npm run start:dev`.

## Required Checks Before Completion
- `npm run typecheck`
- `npm run build`

If DB-related code changed:
- generate or update migration
- run `npm run migration:run` on a clean database

## Coding Rules
- Keep TypeScript `strict` compatibility.
- Preserve existing module boundaries (`analysis`, `bot`, `entities`, `messages`, `telegram-users`).
- Avoid changing public behavior of bot commands unless explicitly requested.
- Prefer small, targeted patches.
- Do not commit secrets or real API keys.

## Data & Persistence Notes
- `messages.raw_payload` stores original Telegram payload (`jsonb`), so treat as sensitive data.
- `entities` are replaced per message via `EntitiesService.replaceForMessage`.
- `telegram_users` is upserted on incoming updates and callback queries.

## Review Focus (When Asked for Code Review)
- Runtime failures in bot startup/shutdown path.
- Duplicate message ingestion / idempotency.
- Migration safety and backward compatibility.
- Error handling around external LLM calls and fallback behavior.
