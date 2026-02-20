# 🚀 Deployment Guide

Инструкция по развертыванию AirPost на production-сервере с использованием Docker.

## 📋 Требования

- Linux сервер (Ubuntu 22.04+ / Debian 11+ / CentOS 8+)
- Docker 24.0+
- Docker Compose 2.20+
- 2GB RAM минимум
- 10GB свободного места на диске

## 🔧 Установка Docker (Ubuntu/Debian)

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить зависимости
sudo apt install -y ca-certificates curl gnupg lsb-release

# Добавить GPG ключ Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Добавить репозиторий Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Установить Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Проверить установку
docker --version
docker compose version
```

## 📦 Развертывание приложения

### 1. Клонировать репозиторий

```bash
git clone https://github.com/panovps/airposts
cd airpost
```

### 2. Создать .env файл

```bash
# Скопировать пример конфигурации
cp .env.production.example .env

# Отредактировать конфигурацию
nano .env
```

**Обязательные параметры для изменения:**

```env
# Сильный пароль для PostgreSQL
POSTGRES_PASSWORD=your_secure_password_here

# Токен бота от @BotFather
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# API ключ выбранного LLM провайдера
OPENAI_API_KEY=sk-...
# или
ANTHROPIC_API_KEY=sk-ant-...
# или
DEEPSEEK_API_KEY=sk-...
```

### 3. Запустить приложение

```bash
# Собрать и запустить в фоновом режиме
docker compose up -d --build

# Проверить логи
docker compose logs -f

# Проверить статус контейнеров
docker compose ps
```

### 4. Проверить работу

```bash
# Логи приложения
docker compose logs app

# Логи PostgreSQL
docker compose logs postgres

# Проверить health check
docker inspect airpost-app | grep -A 10 Health
```

## 🔄 Управление приложением

### Остановить приложение

```bash
docker compose down
```

### Перезапустить приложение

```bash
docker compose restart app
```

### Обновить приложение

```bash
# Получить последние изменения
git pull

# Пересобрать и перезапустить
docker compose up -d --build

# Проверить логи
docker compose logs -f app
```

### Просмотр логов

```bash
# Все логи
docker compose logs

# Только приложение
docker compose logs app

# Только база данных
docker compose logs postgres

# Следить за логами в реальном времени
docker compose logs -f app
```

## 🗃️ Работа с базой данных

### Backup базы данных

```bash
# Создать backup
docker compose exec postgres pg_dump -U airpost airpost > backup_$(date +%Y%m%d_%H%M%S).sql

# Или через docker
docker exec airpost-postgres pg_dump -U airpost airpost > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore базы данных

```bash
# Восстановить из backup
cat backup_20260218_123456.sql | docker compose exec -T postgres psql -U airpost airpost
```

### Подключиться к PostgreSQL

```bash
# Через docker exec
docker compose exec postgres psql -U airpost airpost

# Полезные команды:
# \dt - список таблиц
# \d table_name - структура таблицы
# \q - выход
```

### Запустить миграции вручную

```bash
# Войти в контейнер приложения
docker compose exec app sh

# Запустить миграции
npm run migration:run

# Откатить последнюю миграцию
npm run migration:revert

# Выйти
exit
```

## 🔐 Безопасность

### Firewall настройка (UFW)

```bash
# Установить UFW
sudo apt install ufw

# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS (если используете reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

### Настройка reverse proxy (Nginx)

```bash
# Установить Nginx
sudo apt install nginx

# Создать конфигурацию
sudo nano /etc/nginx/sites-available/airpost
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Активировать конфигурацию
sudo ln -s /etc/nginx/sites-available/airpost /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

### SSL сертификат (Let's Encrypt)

```bash
# Установить certbot
sudo apt install certbot python3-certbot-nginx

# Получить сертификат
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление настроено автоматически
```

## 📊 Мониторинг

### Проверка использования ресурсов

```bash
# Статистика контейнеров
docker stats

# Использование диска
docker system df
```

### Логирование

```bash
# Настроить rotation логов
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Перезапустить Docker
sudo systemctl restart docker
```

## 🆘 Troubleshooting

### Приложение не запускается

```bash
# Проверить логи
docker compose logs app

# Проверить переменные окружения
docker compose exec app env | grep -E 'BOT_TOKEN|DATABASE_URL|LLM'

# Пересобрать без кэша
docker compose build --no-cache
docker compose up -d
```

### База данных недоступна

```bash
# Проверить статус PostgreSQL
docker compose ps postgres

# Проверить логи
docker compose logs postgres

# Перезапустить PostgreSQL
docker compose restart postgres
```

### Ошибки миграций

```bash
# Проверить текущее состояние миграций
docker compose exec app npm run migration:show

# Откатить последнюю миграцию
docker compose exec app npm run migration:revert

# Запустить миграции заново
docker compose exec app npm run migration:run
```

### Очистка Docker ресурсов

```bash
# Удалить неиспользуемые образы
docker image prune -a

# Удалить неиспользуемые volumes
docker volume prune

# Полная очистка (ВНИМАНИЕ: удалит все неиспользуемые ресурсы)
docker system prune -a --volumes
```

## 🔄 CI/CD (опционально)

### GitHub Actions пример

Создайте `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/airpost
            git pull
            docker compose up -d --build
```

## 📝 Полезные команды

```bash
# Полный перезапуск с очисткой
docker compose down -v
docker compose up -d --build

# Экспорт переменных окружения
docker compose exec app env

# Выполнить команду в контейнере
docker compose exec app npm run typecheck

# Посмотреть размер образов
docker images | grep airpost
```

## 🎯 Production checklist

- [ ] Изменены все пароли по умолчанию
- [ ] Настроен firewall
- [ ] Настроен SSL сертификат
- [ ] Настроен backup базы данных (cron)
- [ ] Настроен мониторинг (опционально)
- [ ] Протестирован процесс восстановления из backup
- [ ] Настроен log rotation
- [ ] Проверена работа бота в Telegram
