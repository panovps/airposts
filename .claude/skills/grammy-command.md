---
user-invocable: true
context: fork
allowed-tools:
  - Read
  - Edit
  - Grep
  - Bash(npm run typecheck)
---

# Создать новую команду для grammY бота

Добавь новую команду в Telegram-бот (AirPost) с учётом существующей архитектуры проекта.

## Шаги:

1. **Прочитай bot.service.ts** чтобы понять текущую структуру команд
2. **Добавь обработчик команды** в методе `registerHandlers()`:
   - Используй паттерн `bot.command('name', async (ctx) => {...})`
   - Всегда делай upsert пользователя через `telegramUsersService`
   - Используй `botTemplateService` для рендеринга ответов
3. **Создай метод в bot-template.service.ts** для рендеринга ответа команды
4. **Добавь команду в список** в методе `onModuleInit()` через `setMyCommands()`
5. **Создай или обнови тесты** в bot.service.spec.ts
6. **Запусти typecheck** для проверки типов

## Важные паттерны:

- **HTML-форматирование**: используй только разрешённые теги (см. telegram-html skill)
- **Escape спецсимволы**: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`
- **Upsert пользователя**: всегда первым делом в обработчике
- **Обработка ошибок**: проверяй наличие `ctx.from` перед работой с пользователем
- **Шаблоны**: все тексты ответов через `botTemplateService.render*()`

## Пример команды:

```typescript
bot.command('stats', async (ctx) => {
  if (!ctx.from) {
    await ctx.reply(this.botTemplateService.renderErrorNoUser());
    return;
  }

  const telegramUser = await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
  const stats = await this.someService.getStats(telegramUser.id);

  await ctx.reply(this.botTemplateService.renderStats(stats), {
    parse_mode: 'HTML'
  });
});
```

После выполнения:
- Проверь типы: `npm run typecheck`
- Опиши что было добавлено