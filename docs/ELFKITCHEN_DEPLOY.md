# Another project deployment guide

# Elfkitchen — Инструкция по деплою

## Информация о проекте

- Домен: https://elfkitchen.christmas
- Директория на сервере: `/opt/elfkitchen/`
- Компоненты:
  - elfkitchen-client (frontend, nginx) — порт 80
  - elfkitchen-server (backend API) — порт 3001
  - elfkitchen-bot (Telegram бот)

## Архитектура проекта

```
┌─────────────────────────────────────────────────────────┐
│                    Traefik                              │
│              (traefik-public сеть)                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│               elfkitchen-client                         │
│                  (nginx:80)                             │
│         Сети: traefik-public, elfkitchen-internal       │
└─────────────────────┬───────────────────────────────────┘
                      │ (elfkitchen-internal сеть)
                      ▼
┌─────────────────────────────────────────────────────────┐
│               elfkitchen-server                         │
│                 (node:3001)                             │
│              Сеть: elfkitchen-internal                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                elfkitchen-bot                           │
│              (Telegram polling)                         │
│              Сеть: elfkitchen-internal                  │
└─────────────────────────────────────────────────────────┘
```

## Файлы конфигурации

### docker-compose.prod.yml

Путь: `/opt/elfkitchen/docker-compose.prod.yml`

```yaml
services:
  elfkitchen-server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: elfkitchen-server
    restart: unless-stopped
    expose:
      - "3001"
    environment:
      - NODE_ENV=production
      - AIRTABLE_PAT=${AIRTABLE_PAT}
      - AIRTABLE_BASE_ID=${AIRTABLE_BASE_ID}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - PORT=3001
    networks:
      - elfkitchen-internal
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/api/days"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  elfkitchen-bot:
    build:
      context: ./server
      dockerfile: Dockerfile.bot
    container_name: elfkitchen-bot
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - AIRTABLE_PAT=${AIRTABLE_PAT}
      - AIRTABLE_BASE_ID=${AIRTABLE_BASE_ID}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    networks:
      - elfkitchen-internal
    depends_on:
      - elfkitchen-server

  elfkitchen-client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: elfkitchen-client
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.elfkitchen.rule=Host(`elfkitchen.christmas`) || Host(`www.elfkitchen.christmas`)"
      - "traefik.http.routers.elfkitchen.entrypoints=websecure"
      - "traefik.http.routers.elfkitchen.tls.certresolver=myresolver"
      - "traefik.http.services.elfkitchen.loadbalancer.server.port=80"
    networks:
      - traefik-public
      - elfkitchen-internal
    depends_on:
      - elfkitchen-server

networks:
  traefik-public:
    external: true
  elfkitchen-internal:
    driver: bridge
```

### .env файл

Путь: `/opt/elfkitchen/.env`

```env
AIRTABLE_PAT=pat_xxxxxxxxxxxxx
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

## Структура исходного кода

```
/opt/elfkitchen/
├── docker-compose.prod.yml
├── .env
├── server/
│   ├── Dockerfile          # Backend API
│   ├── Dockerfile.bot      # Telegram bot
│   └── src/
└── client/
    ├── Dockerfile          # Frontend (nginx)
    └── src/
```

## Деплой нового кода

### Полный деплой (все компоненты)

```bash
cd /opt/elfkitchen

# Остановить текущие контейнеры
docker compose -f docker-compose.prod.yml down

# Пересобрать все образы
docker compose -f docker-compose.prod.yml build

# Запустить
docker compose -f docker-compose.prod.yml up -d

# Проверить статус
docker ps | grep elfkitchen
```

### Деплой только frontend

```bash
cd /opt/elfkitchen

# Пересобрать только client
docker compose -f docker-compose.prod.yml build elfkitchen-client

# Пересоздать контейнер
docker compose -f docker-compose.prod.yml up -d --no-deps elfkitchen-client
```

### Деплой только backend (server + bot)

```bash
cd /opt/elfkitchen

# Пересобрать server и bot
docker compose -f docker-compose.prod.yml build elfkitchen-server elfkitchen-bot

# Перезапустить
docker compose -f docker-compose.prod.yml up -d --no-deps elfkitchen-server elfkitchen-bot
```

## Обновление кода с Git

Если код хранится в git репозитории:

```bash
cd /opt/elfkitchen

# Получить изменения
git pull origin main

# Пересобрать и перезапустить
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Проверка работоспособности

```bash
# Все контейнеры запущены?
docker ps | grep elfkitchen

# Server healthy?
docker inspect elfkitchen-server | grep -A 5 Health

# Логи каждого компонента
docker logs elfkitchen-server --tail 30
docker logs elfkitchen-client --tail 30
docker logs elfkitchen-bot --tail 30

# API отвечает?
docker exec elfkitchen-client wget -qO- http://elfkitchen-server:3001/api/days

# Сайт доступен?
curl -I https://elfkitchen.christmas
```

## Просмотр логов

```bash
# Все логи вместе
docker compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker compose -f docker-compose.prod.yml logs -f elfkitchen-server

# Последние 100 строк
docker logs elfkitchen-bot --tail 100
```

## Перезапуск сервисов

```bash
cd /opt/elfkitchen

# Перезапуск всего
docker compose -f docker-compose.prod.yml restart

# Перезапуск одного сервиса
docker compose -f docker-compose.prod.yml restart elfkitchen-bot
```

## Частые проблемы

### Telegram бот не отвечает
```bash
# Проверить токен в .env
cat .env | grep TELEGRAM

# Проверить логи бота
docker logs elfkitchen-bot --tail 50

# Перезапустить бота
docker compose -f docker-compose.prod.yml restart elfkitchen-bot
```

### Server unhealthy
```bash
# Проверить что сервер запустился
docker logs elfkitchen-server

# Проверить healthcheck
docker inspect elfkitchen-server | grep -A 10 Health

# Проверить соединение с Airtable (в логах)
docker logs elfkitchen-server | grep -i airtable
```

### Сайт недоступен
```bash
# Проверить Traefik
docker logs traefik | grep elfkitchen

# Проверить что client в нужных сетях
docker network inspect traefik-public | grep elfkitchen
```

### Ошибка сборки образа
```bash
# Очистить кэш Docker и пересобрать
docker compose -f docker-compose.prod.yml build --no-cache
```

## Откат к предыдущей версии

```bash
# Посмотреть историю образов
docker images | grep elfkitchen

# Если образы помечены тегами версий
docker compose -f docker-compose.prod.yml down
# Изменить теги в docker-compose.prod.yml или использовать:
docker tag elfkitchen-elfkitchen-client:previous elfkitchen-elfkitchen-client:latest
docker compose -f docker-compose.prod.yml up -d
```

## Бэкап перед деплоем

Рекомендуется сохранять образы перед обновлением:

```bash
# Сохранить текущие образы
docker tag elfkitchen-elfkitchen-client:latest elfkitchen-elfkitchen-client:backup-$(date +%Y%m%d)
docker tag elfkitchen-elfkitchen-server:latest elfkitchen-elfkitchen-server:backup-$(date +%Y%m%d)
docker tag elfkitchen-elfkitchen-bot:latest elfkitchen-elfkitchen-bot:backup-$(date +%Y%m%d)
```
