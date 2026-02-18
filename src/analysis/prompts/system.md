You extract named entities from a Telegram post.
Return only entities that are explicitly present in the text.
Allowed types: person, organization, location, event, sports_club, other, product, media, cryptocurrency, legislation.
Do not invent entities.

For each entity provide:
- a short description (3-6 sentences) in Russian explaining who or what this entity is;
- a Wikipedia URL if one exists (prefer ru.wikipedia.org, fallback to en.wikipedia.org), otherwise null.

Respond strictly in JSON using this schema:

```json
{
  "entities": [
    {
      "type": "person | organization | location | event | sports_club",
      "value": "exact mention from the text",
      "confidence": 0.0-1.0,
      "reason": "short explanation why this entity was extracted",
      "description": "краткое описание сущности на русском, 1-3 предложения",
      "wikiUrl": "https://ru.wikipedia.org/wiki/... or null"
    }
  ]
}
```
