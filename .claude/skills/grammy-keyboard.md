---
user-invocable: true
context: fork
allowed-tools:
  - Read
  - Edit
  - Grep
---

# Создать inline-клавиатуру для grammY

Добавь или обнови inline-клавиатуру в Telegram-боте с использованием grammY InlineKeyboard API.

## Шаги:

1. **Импортируй InlineKeyboard** из grammy (если ещё не импортирован)
2. **Создай клавиатуру**:
   ```typescript
   const keyboard = new InlineKeyboard();
   ```
3. **Добавь кнопки**:
   - `.text(label, callbackData)` - обычная кнопка
   - `.url(label, url)` - кнопка-ссылка
   - `.webApp(label, url)` - web app кнопка
   - `.row()` - перенос на новую строку
4. **Добавь обработчик callback_query** если используешь callback кнопки:
   ```typescript
   bot.on('callback_query:data', async (ctx) => {
     await ctx.answerCallbackQuery();
     // обработка данных
   });
   ```

## Типы кнопок:

### Callback кнопка (для действий в боте):
```typescript
keyboard
  .text('Кнопка 1', 'action_1')
  .text('Кнопка 2', 'action_2')
  .row()
  .text('Отмена', 'cancel');
```

### URL кнопка (внешние ссылки):
```typescript
keyboard
  .url('GitHub', 'https://github.com')
  .url('Документация', 'https://grammy.dev');
```

### Web App кнопка (открывает веб-приложение):
```typescript
keyboard.webApp('Открыть приложение', 'https://example.com/app');
```

## Использование в ответе:

```typescript
await ctx.reply('Выберите действие:', {
  reply_markup: keyboard,
  parse_mode: 'HTML'
});
```

## Пример из проекта:

В `bot.service.ts` уже используется динамическая клавиатура с wiki-ссылками:

```typescript
const keyboard = new InlineKeyboard();
for (const detection of detections) {
  if (detection.wikiUrl) {
    keyboard.webApp(detection.value, detection.wikiUrl);
    if (buttonCount % 2 === 0) {
      keyboard.row(); // 2 кнопки в строке
    }
  }
}
```

После создания клавиатуры опиши её структуру и назначение кнопок.