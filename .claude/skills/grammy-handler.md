---
user-invocable: true
context: fork
allowed-tools:
  - Read
  - Edit
  - Grep
  - Bash(npm run typecheck)
---

# Создать обработчик событий для grammY

Добавь обработчик событий (message, edited_message, callback_query, etc.) в Telegram-бот.

## Типы обработчиков:

### 1. Обработчик сообщений
```typescript
bot.on('message', async (ctx) => {
  // обработка любого сообщения
});

bot.on('message:text', async (ctx) => {
  // только текстовые сообщения
});

bot.on('message:photo', async (ctx) => {
  // только фото
});
```

### 2. Обработчик редактирования
```typescript
bot.on('edited_message', async (ctx) => {
  // обработка отредактированных сообщений
});
```

### 3. Обработчик callback-кнопок
```typescript
bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery(); // обязательно!

  const data = ctx.callbackQuery.data;
  if (data === 'action_1') {
    // обработка действия
  }
});
```

### 4. Обработчик inline-запросов
```typescript
bot.on('inline_query', async (ctx) => {
  await ctx.answerInlineQuery([...results]);
});
```

## Шаги:

1. **Определи тип события** которое нужно обрабатывать
2. **Добавь обработчик в registerHandlers()** в bot.service.ts
3. **Сделай upsert пользователя** через `telegramUsersService`
4. **Реализуй бизнес-логику**:
   - Сохрани данные через соответствующий сервис
   - Выполни нужные операции
5. **Отправь ответ** через `ctx.reply()` или другие методы
6. **Добавь тесты** в bot.service.spec.ts
7. **Запусти typecheck**

## Важные паттерны:

- **Проверка ctx.from**: всегда проверяй наличие отправителя
- **AnswerCallbackQuery**: обязательно вызывай для callback_query
- **Обработка ошибок**: оборачивай в try-catch если есть риск ошибок
- **Логирование**: используй `this.logger` для важных событий

## Пример из проекта:

В `bot.service.ts` есть обработчик сообщений:

```typescript
private async handleMessageUpdate(ctx: BotContext, type: IncomingMessageType): Promise<void> {
  if (!ctx.from) {
    this.logger.warn('Incoming update without sender was skipped');
    return;
  }

  const telegramUser = await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
  const message = await this.messagesService.storeFromContext(ctx, type, telegramUser.id);

  const sourceText = message.text?.trim();

  if (type === 'message' && sourceText) {
    const pending = await ctx.reply(this.botTemplateService.renderAnalysisPending());
    const detections = await this.analysisService.analyze(sourceText);
    await this.entitiesService.replaceForMessage(message.id, detections);
    // ... отправка результата
  }
}
```

После создания обработчика:
- Опиши какое событие обрабатывается
- Что делает обработчик
- Запусти `npm run typecheck`