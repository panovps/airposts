---
name: telegram-html
description: Reference for Telegram Bot API HTML formatting. Use when writing or editing bot reply text that uses parse_mode HTML.
---

When composing or editing Telegram bot messages with `parse_mode: 'HTML'`, use only these supported tags:

## Text styling

- `<b>bold</b>` or `<strong>bold</strong>`
- `<i>italic</i>` or `<em>italic</em>`
- `<u>underline</u>` or `<ins>underline</ins>`
- `<s>strikethrough</s>` or `<strike>strikethrough</strike>` or `<del>strikethrough</del>`
- `<span class="tg-spoiler">spoiler</span>` or `<tg-spoiler>spoiler</tg-spoiler>`

## Links and mentions

- `<a href="https://example.com/">inline URL</a>`
- `<a href="tg://user?id=123456789">inline mention</a>`

## Custom emoji

- `<tg-emoji emoji-id="5368324170671202286">👍</tg-emoji>`

## Code

- `<code>inline code</code>`
- `<pre>code block</pre>`
- `<pre><code class="language-python">code block with syntax highlight</code></pre>`

## Quotes

- `<blockquote>block quote</blockquote>`
- `<blockquote expandable>expandable block quote</blockquote>`

## Nesting

Tags can be nested: `<b>bold <i>italic bold <u>underline italic bold</u></i> bold</b>`

## Rules

- Only the tags listed above are allowed. Any other HTML tag will cause an API error.
- All `<`, `>`, and `&` characters that are not part of a tag or HTML entity must be escaped: `&lt;`, `&gt;`, `&amp;`.
- Ensure every opened tag is properly closed.
- When building reply strings in code, always escape user-provided text with a helper like `escapeHtml()` before inserting it into the template.