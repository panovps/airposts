---
user-invocable: true
context: fork
allowed-tools:
  - Read
  - Edit
  - Grep
  - Bash(npm run typecheck)
---

# Создать middleware для grammY

Добавь middleware в Telegram-бот для логирования, обработки ошибок или других сквозных функций.

## Что такое middleware?

Middleware в grammY - это функция, которая выполняется **перед** обработчиками и может:
- Логировать запросы
- Проверять права доступа
- Измерять время выполнения
- Модифицировать контекст
- Останавливать выполнение цепочки

## Типы middleware:

### 1. Логирование
```typescript
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next(); // выполнить следующий middleware/обработчик
  const duration = Date.now() - start;
  this.logger.log(`Processed update in ${duration}ms`);
});
```

### 2. Проверка прав доступа
```typescript
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('Ошибка: нет информации о пользователе');
    return; // прекратить выполнение
  }

  const isAllowed = await this.checkAccess(userId);
  if (!isAllowed) {
    await ctx.reply('Доступ запрещён');
    return;
  }

  await next(); // продолжить если доступ разрешён
});
```

### 3. Автоматический upsert пользователя
```typescript
bot.use(async (ctx, next) => {
  if (ctx.from) {
    await this.telegramUsersService.upsertFromTelegramUser(ctx.from);
  }
  await next();
});
```

### 4. Обработка ошибок
```typescript
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    this.logger.error('Error in handler', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});
```

### 5. Ограничение частоты запросов (rate limiting)
```typescript
private readonly userLastRequest = new Map<number, number>();

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }

  const now = Date.now();
  const lastRequest = this.userLastRequest.get(userId) ?? 0;

  if (now - lastRequest < 1000) { // минимум 1 секунда между запросами
    await ctx.reply('Слишком частые запросы. Подождите немного.');
    return;
  }

  this.userLastRequest.set(userId, now);
  await next();
});
```

## Порядок выполнения middleware:

```typescript
// Middleware выполняются в порядке регистрации
bot.use(middleware1); // выполнится первым
bot.use(middleware2); // выполнится вторым
bot.command('start', handler); // выполнится последним
```

## Middleware для конкретных обработчиков:

```typescript
// Только для команды /admin
bot.command('admin', async (ctx, next) => {
  if (!this.isAdmin(ctx.from?.id)) {
    await ctx.reply('Только для администраторов');
    return;
  }
  await next();
}, async (ctx) => {
  // обработчик команды
  await ctx.reply('Админ-панель');
});
```

## Composer для группировки:

```typescript
import { Composer } from 'grammy';

const adminCommands = new Composer();

adminCommands.use(async (ctx, next) => {
  // middleware только для админ-команд
  if (!this.isAdmin(ctx.from?.id)) {
    return;
  }
  await next();
});

adminCommands.command('ban', ...);
adminCommands.command('unban', ...);

bot.use(adminCommands);
```

## Шаги:

1. **Определи назначение middleware**
2. **Добавь в registerHandlers()** перед регистрацией команд:
   ```typescript
   bot.use(async (ctx, next) => {
     // твоя логика
     await next();
   });
   ```
3. **Учти порядок выполнения** - middleware регистрируются последовательно
4. **Добавь логирование** для отладки
5. **Запусти typecheck**

После создания опиши:
- Что делает middleware
- В каком порядке выполняется
- Когда останавливает выполнение цепочки