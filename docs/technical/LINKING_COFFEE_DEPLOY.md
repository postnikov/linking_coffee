# Linking Coffee — Инструкция по деплою

## Информация о проекте

- Домен: https://linked.coffee (и редирект с linkingcoffee.com)
- Директория на сервере: `/opt/linking-coffee/`
- Компоненты:
  - linking-coffee-frontend (nginx) — порт 80 (внутри контейнера)
  - linking-coffee-backend (node api) — порт 3001
  - Telegram бот (интегрирован в backend или отдельный сервис в будущем)

## Архитектура проекта

```
┌─────────────────────────────────────────────────────────┐
│                    Traefik                              │
│              (traefik-public сеть)                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│            linking-coffee-frontend                      │
│                  (nginx:80)                             │
│         Сети: traefik-public, linking-coffee-internal   │
└─────────────────────┬───────────────────────────────────┘
                      │ (linking-coffee-internal сеть)
                      ▼
┌─────────────────────────────────────────────────────────┐
│            linking-coffee-backend                       │
│                 (node:3001)                             │
│           Сеть: linking-coffee-internal                 │
└─────────────────────────────────────────────────────────┘
```

## Файлы конфигурации

### docker-compose.prod.yml

Путь: `/opt/linking-coffee/docker-compose.prod.yml`

(См. файл в репозитории)

### .env файл

Путь: `/opt/linking-coffee/.env`

```env
AIRTABLE_API_KEY=your_key
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_MEMBERS_TABLE=tblCrnbDupkzWUx9P
BOT_TOKEN=your_bot_token
ADMIN_BOT_TOKEN=your_admin_token
ADMIN_CHAT_ID=your_chat_id
PORT=3001
NODE_ENV=production
```

## Структура директорий на сервере

```
/opt/linking-coffee/
├── docker-compose.prod.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── ...
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── ...
```

## Первоначальная настройка на VPS

1. **Создайте директорию:**
   ```bash
   sudo mkdir -p /opt/linking-coffee
   sudo chown $USER:$USER /opt/linking-coffee
   ```

2. **Клонируйте репозиторий или скопируйте файлы:**
   ```bash
   git clone <your-repo-url> /opt/linking-coffee
   # ИЛИ скопируйте файлы через SCP
   # scp -r ./* user@your-vps:/opt/linking-coffee/
   ```

3. **Создайте .env файл:**
   ```bash
   cp .env.example .env
   nano .env
   # Заполните реальными данными
   ```

4. **Настройте домен в docker-compose.prod.yml:**
   Если домен отличается от `linkingcoffee.com`, отредактируйте labels в `docker-compose.prod.yml`:
   ```yaml
   - "traefik.http.routers.linking-coffee.rule=Host(`linked.coffee`) || Host(`www.linked.coffee`) || Host(`linkingcoffee.com`)"
   ```

## Деплой

### Полный запуск

```bash
cd /opt/linking-coffee

# Запуск в фоновом режиме
docker compose -f docker-compose.prod.yml up -d --build
```

### Обновление кода

```bash
cd /opt/linking-coffee

# Получить изменения (если используется git)
git pull origin main

# Пересобрать и перезапустить
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

## Проверка работоспособности

```bash
# Статус контейнеров
docker ps | grep linking-coffee

# Логи backend
docker logs linking-coffee-backend --tail 50

# Логи frontend
docker logs linking-coffee-frontend --tail 50

# Проверка API изнутри
docker exec linking-coffee-frontend wget -qO- http://linking-coffee-backend:3001/api/health
```

## Траблшутинг

### Сайт недоступен (502 Bad Gateway)
- Проверьте, что backend запущен и healthy.
- Проверьте логи frontend: `docker logs linking-coffee-frontend`
- Проверьте, что контейнеры в сети `traefik-public`.

### Ошибки подключения к Airtable
- Проверьте `AIRTABLE_API_KEY` и `AIRTABLE_BASE_ID` в `.env`.
- Посмотрите логи backend на наличие ошибок API.

### SSL сертификаты
- Traefik должен автоматически получить сертификаты Let's Encrypt.
- Если сертификата нет, проверьте логи Traefik: `docker logs traefik`
