# PRD: Автоматический бэкап Airtable

## Контекст

Linked.Coffee — Random Coffee платформа, данные которой хранятся в Airtable (план Pro). Проект развернут на VPS (Hetzner). Часть скриптов пока запускается локально на Mac.

Airtable — внешний сервис без гарантий сохранности данных. Нужна автономная система бэкапов.

## Цель

Создать автоматическую систему ежедневного бэкапа всех таблиц Airtable с хранением локально на VPS и синхронизацией в Google Drive.

## Архитектура

```
┌─────────────┐    ┌─────────────────────────────┐    ┌─────────────┐
│  Airtable   │───▶│  VPS (Hetzner)              │───▶│Google Drive │
│  (API)      │    │                             │    │             │
└─────────────┘    │  /backups/airtable/         │    │  /Backups/  │
                   │    ├── daily/               │    │  LinkedCoffee/
                   │    │   ├── 2025-01-15.json.gz    │             │
                   │    │   ├── 2025-01-14.json.gz    └─────────────┘
                   │    │   └── ...               │
                   │    └── latest.json          │
                   │                             │
                   │  cron: 03:00 UTC ежедневно  │
                   └─────────────────────────────┘
```

## Требования

### Функциональные

1. Скрипт `backup-airtable.js` должен:
   - Выгружать все записи из всех 5 таблиц (Members, Matches, Countries, Cities, Logs)
   - Сохранять в единый JSON файл со структурой `{ tableName: records[] }`
   - Сжимать результат в .json.gz
   - Именовать файл по дате: `backup-YYYY-MM-DD.json.gz`
   - Создавать/обновлять `latest.json` (несжатый, для быстрого доступа)
   - Удалять локальные бэкапы старше 7 дней
   - Логировать результат (количество записей по таблицам, размер файла)

2. Скрипт `sync-to-gdrive.sh` должен:
   - Использовать rclone для синхронизации папки бэкапов с Google Drive
   - Хранить в Google Drive последние 30 дней
   - Логировать результат синхронизации

3. Cron-задача должна:
   - Запускать backup-airtable.js в 03:00 UTC
   - Запускать sync-to-gdrive.sh в 03:30 UTC
   - Писать логи в `/var/log/airtable-backup.log`

### Нефункциональные

- Скрипт должен корректно обрабатывать ошибки API (rate limits, timeout)
- При ошибке — не удалять предыдущие бэкапы
- Время выполнения бэкапа: < 2 минут для текущего объема данных
- Размер несжатого бэкапа: ожидаемо < 5 MB

## Структура файлов

```
backend/
├── scripts/
│   ├── backup-airtable.js      # Основной скрипт бэкапа
│   └── sync-to-gdrive.sh       # Синхронизация с Google Drive
├── config/
│   └── backup-config.js        # Конфигурация (пути, retention)
└── ...

/backups/airtable/              # На VPS
├── daily/
│   ├── backup-2025-01-15.json.gz
│   ├── backup-2025-01-14.json.gz
│   └── ...
├── latest.json
└── backup.log
```

## Конфигурация

### Переменные окружения (.env)

Уже существуют:
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`

Добавить:
- `BACKUP_DIR=/backups/airtable` — путь к папке бэкапов
- `BACKUP_RETENTION_DAYS=7` — сколько дней хранить локально
- `GDRIVE_RETENTION_DAYS=30` — сколько дней хранить в Google Drive
- `GDRIVE_REMOTE=gdrive:Backups/LinkedCoffee` — rclone remote path

### Таблицы для бэкапа

Из DATABASE_SCHEMA.md:

| Таблица   | Table ID              |
|-----------|-----------------------|
| Members   | tblCrnbDupkzWUx9P     |
| Countries | tblTDQuqGDEDTPMLO     |
| Cities    | tbllGzaGTz3PsxxWT     |
| Matches   | tblx2OEN5sSR1xFI2     |
| Logs      | tbln4rLHEgXUkL9Jh     |

## Формат бэкапа

```json
{
  "metadata": {
    "created_at": "2025-01-15T03:00:00.000Z",
    "base_id": "appXXXXXXXX",
    "tables_count": 5,
    "total_records": 1234
  },
  "tables": {
    "Members": {
      "table_id": "tblCrnbDupkzWUx9P",
      "records_count": 150,
      "records": [
        {
          "id": "recXXXXXX",
          "createdTime": "2024-01-01T00:00:00.000Z",
          "fields": { ... }
        }
      ]
    },
    "Matches": { ... },
    "Countries": { ... },
    "Cities": { ... },
    "Logs": { ... }
  }
}
```

## CLI интерфейс

```bash
# Запуск бэкапа
node backend/scripts/backup-airtable.js

# Опции
node backend/scripts/backup-airtable.js --dry-run     # Только показать что будет сделано
node backend/scripts/backup-airtable.js --no-cleanup  # Не удалять старые бэкапы
node backend/scripts/backup-airtable.js --output=/custom/path  # Кастомный путь

# Синхронизация
./backend/scripts/sync-to-gdrive.sh
./backend/scripts/sync-to-gdrive.sh --dry-run
```

## Логирование

Формат лога:

```
[2025-01-15 03:00:00] INFO: Starting Airtable backup
[2025-01-15 03:00:01] INFO: Fetching Members... 150 records
[2025-01-15 03:00:02] INFO: Fetching Matches... 89 records
[2025-01-15 03:00:02] INFO: Fetching Countries... 195 records
[2025-01-15 03:00:03] INFO: Fetching Cities... 312 records
[2025-01-15 03:00:03] INFO: Fetching Logs... 488 records
[2025-01-15 03:00:04] INFO: Total records: 1234
[2025-01-15 03:00:04] INFO: Saved to /backups/airtable/daily/backup-2025-01-15.json.gz (245 KB)
[2025-01-15 03:00:04] INFO: Updated latest.json (1.2 MB)
[2025-01-15 03:00:04] INFO: Cleanup: removed 1 old backup(s)
[2025-01-15 03:00:04] INFO: Backup completed in 4.2s
```

## Восстановление (для справки)

Скрипт восстановления не входит в scope этого PRD, но бэкап должен быть достаточным для:

1. Ручного восстановления через Airtable UI (импорт JSON)
2. Программного восстановления через Airtable API
3. Анализа данных локально (jq, Python, etc.)

## Настройка rclone (инструкция)

После реализации скриптов, на VPS нужно:

```bash
# 1. Установить rclone
curl https://rclone.org/install.sh | sudo bash

# 2. Настроить Google Drive remote
rclone config
# → n (new remote)
# → name: gdrive
# → storage: drive
# → ... (следовать инструкциям OAuth)

# 3. Проверить подключение
rclone ls gdrive:

# 4. Создать папку для бэкапов
rclone mkdir gdrive:Backups/LinkedCoffee
```

## Cron настройка

```cron
# /etc/cron.d/airtable-backup

# Бэкап в 03:00 UTC
0 3 * * * root cd /path/to/project && /usr/bin/node backend/scripts/backup-airtable.js >> /var/log/airtable-backup.log 2>&1

# Синхронизация в 03:30 UTC
30 3 * * * root /path/to/project/backend/scripts/sync-to-gdrive.sh >> /var/log/airtable-backup.log 2>&1
```

## Критерии приемки

1. [ ] Скрипт backup-airtable.js создает корректный JSON со всеми таблицами
2. [ ] Файл сжимается в .gz
3. [ ] latest.json обновляется при каждом запуске
4. [ ] Старые бэкапы (>7 дней) удаляются автоматически
5. [ ] --dry-run показывает план без изменений
6. [ ] Ошибки API обрабатываются gracefully (retry, логирование)
7. [ ] sync-to-gdrive.sh успешно загружает файлы в Google Drive
8. [ ] Логи читаемы и информативны

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Airtable rate limit | Средняя | Добавить задержку между запросами (100ms) |
| Google Drive quota | Низкая | Мониторить размер, алерт при >80% |
| VPS диск заполнен | Низкая | Retention policy, мониторинг |
| OAuth token expired | Средняя | rclone автообновляет, но проверить логи |

## Вне scope

- Инкрементальные бэкапы (только изменения)
- Шифрование бэкапов
- Автоматическое восстановление
- Уведомления об ошибках (Telegram/email) — можно добавить позже
- Бэкап attachments (файлы в Airtable) — только метаданные

---

## Дополнительные заметки для разработки

Существующие скрипты проекта используют:
- `require('dotenv').config({ path: path.join(__dirname, '../../.env') })`
- `const Airtable = require('airtable')`
- Паттерн `--dry-run` и `--test` флагов

Рекомендуется следовать этим же паттернам для консистентности.

Airtable API pagination: метод `.all()` автоматически обрабатывает пагинацию, но для больших таблиц лучше использовать `.eachPage()` с явным контролем.
