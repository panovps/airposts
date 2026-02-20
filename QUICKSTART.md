# ⚡ Quick Start Guide

Быстрый запуск AirPost с Docker за 5 минут.

## 🚀 Запуск

```bash
# 1. Склонировать репозиторий
git clone https://github.com/your-username/airpost.git
cd airpost

# 2. Создать .env файл
cp .env.production.example .env

# 3. Отредактировать .env - минимум нужно указать:
# - POSTGRES_PASSWORD (сильный пароль)
# - BOT_TOKEN (от @BotFather)
# - LLM API key (OPENAI_API_KEY / ANTHROPIC_API_KEY / DEEPSEEK_API_KEY)
nano .env

# 4. Запустить приложение
docker compose up -d --build

# 5. Проверить логи
docker compose logs -f
```

## ✅ Проверка

```bash
# Проверить статус контейнеров
docker compose ps

# Должны быть запущены:
# - airpost-postgres (healthy)
# - airpost-app (healthy)

# Проверить логи приложения
docker compose logs app | tail -20

# Должно быть:
# ✅ Migrations completed
# ✅ HTTP server started on port 3000
# ✅ Telegram bot started
```

## 🛑 Остановка

```bash
docker compose down
```

## 🔄 Обновление

```bash
git pull
docker compose up -d --build
```

## 📝 Следующие шаги

- Прочитайте [DEPLOYMENT.md](./DEPLOYMENT.md) для production setup
- Настройте SSL сертификат
- Настройте backup базы данных
- Настройте monitoring
