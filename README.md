# AirPost Telegram Bot

MVP-скелет Telegram-бота на NestJS + grammY с сохранением пользователей и входящих пересланных сообщений (пока только PostgreSQL, без Redis).

## Быстрый старт

1. Скопировать `.env.example` в `.env` и заполнить `BOT_TOKEN`.
2. Выбрать LLM-провайдера в `LLM_PROVIDER` (`openai`, `anthropic`, `deepseek`) и заполнить соответствующий API key.
3. Поднять инфраструктуру (PostgreSQL):

```bash
docker compose up -d
```

4. Установить зависимости и применить миграции:

```bash
npm install
npm run migration:run
```

5. Запустить бота:

```bash
npm run start:dev
```

## Что уже реализовано

- Отдельная таблица `telegram_users`.
- `upsert` пользователя по `telegram_id` при каждом входящем апдейте (`message`, `edited_message`, `callback_query`).
- Таблица `messages` со ссылкой на `telegram_users`.
- Сохранение метаданных пересылки (`source_chat_id`, `source_message_id`) при наличии.
- Базовый анализ текста с выделением `person`, `organization`, `location`, `event`, `sports_club`.
- Таблица `entities` и сохранение сущностей для каждого сообщения.
- Команды бота: `/start`, `/help`, `/history`.
- AI-анализ через `ai-sdk` с роутингом по провайдеру (`openai|anthropic|deepseek`) + fallback-эвристика при ошибках API.

## Миграции TypeORM (из Entity)

- Применить миграции:

```bash
npm run migration:run
```

- Сгенерировать миграцию по изменениям в `Entity`:

```bash
npm run migration:generate --name=MyChange
```

- Создать пустую миграцию вручную:

```bash
npm run migration:create --name=MyManualChange
```

- Откатить последнюю миграцию:

```bash
npm run migration:revert
```
