---
user-invocable: true
context: fork
allowed-tools:
  - Read
  - Edit
  - Grep
  - Bash(npm run typecheck)
---

# Создать или обновить шаблон ответа бота

Добавь новый метод рендеринга в `BotTemplateService` для ответов Telegram-бота.

## Шаги:

1. **Прочитай bot-template.service.ts** чтобы понять существующие паттерны
2. **Создай метод рендеринга**:
   - Имя метода: `render<ИмяШаблона>(параметры): string`
   - Возвращает строку с HTML-разметкой
   - Используй Handlebars шаблоны из `src/bot/templates/`
3. **Создай или обнови .hbs шаблон** в `src/bot/templates/`
4. **Используй корректное HTML-форматирование**:
   - Разрешённые теги: `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a href="">`
   - Escape спецсимволы: используй `escapeHtml` helper
5. **Добавь тесты** в bot-template.service.spec.ts
6. **Запусти typecheck**

## HTML-форматирование (Telegram):

### Текстовое форматирование:
```html
<b>жирный</b>
<i>курсив</i>
<u>подчёркнутый</u>
<s>зачёркнутый</s>
<code>моноширинный код</code>
<pre>блок кода</pre>
<a href="https://example.com">ссылка</a>
```

### Escape специальных символов:
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`

**ВАЖНО**: В атрибуте `href` также нужно экранировать `&`.

## Структура Handlebars шаблона:

```handlebars
<b>{{title}}</b>

{{#if hasData}}
  {{#each items}}
    • {{this.name}}: {{this.value}}
  {{/each}}
{{else}}
  <i>Данные отсутствуют</i>
{{/if}}

{{escapeHtml rawText}}
```

## Пример из проекта:

### Метод в сервисе:
```typescript
renderStart(): string {
  return this.renderTemplate('start');
}

renderAnalysisReply(messageId: string, detections: EntityDetection[], hasText: boolean): string {
  return this.renderTemplate('analysis-reply', { messageId, detections, hasText });
}
```

### Шаблон (start.hbs):
```handlebars
<b>AirPost</b> — анализ сообщений

Перешли любое сообщение, и я найду в нём упоминания людей, организаций, мест и событий.

Команды:
/help — справка
/history — история анализа
```

## Регистрация нового шаблона:

Если создаёшь новый .hbs файл, он автоматически загрузится через механизм в конструкторе `BotTemplateService`.

После создания:
- Опиши что рендерит шаблон
- Покажи пример вывода
- Запусти `npm run typecheck`