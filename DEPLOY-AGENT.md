# Бриф для агента на сервере

Задача: развернуть и обслуживать этот проект на этом VPS. Ниже — что это, как
собрать, запустить и обновлять. Всё нужное уже в репозитории.

## Что это

- **Фронтенд** — одностраничный React-лист персонажа (Pathfinder 1e). Собирается
  esbuild'ом в статику (`dist/`), источник правды по коду — `EilindarCharacterSheet-L5.jsx`.
- **Бэкенд** (`server/`) — маленький Hono + better-sqlite3, key/value API
  `GET/PUT /api/kv/:key` + `GET /api/health`. Хранит данные в SQLite-файле.
- Фронт ходит на относительный `/api` с localStorage-фолбэком, поэтому веб-сервер
  должен отдавать статику и проксировать `/api` на бэкенд (same-origin).

## Требования

- Node.js 20+
- Веб-сервер с TLS и reverse-proxy (пример для Caddy — `deploy/Caddyfile.example`)
- systemd (опционально; можно свой менеджер процессов)

## Первичная установка

Вариант «под ключ» (Ubuntu/Debian, ставит Node/каталоги/.env/systemd/Caddy):
```bash
sudo bash deploy/bootstrap.sh --user <deploy-user> --domain <домен>
```
Он сгенерирует `server/.env`-эквивалент в `/opt/eilindar-server/.env` со случайным
`API_TOKEN` и напечатает его. Если предпочитаешь свою схему — смотри
`SETUP-VPS.md` (ручной вариант) и адаптируй под свой стек.

Ключевые настройки бэкенда (env / файл `.env`):
- `PORT` (по умолчанию 8787)
- `DB_PATH` — путь к файлу SQLite (клади на постоянный диск, не в /tmp)
- `API_TOKEN` — если задан, запись/чтение требуют `Authorization: Bearer <token>`
- `CORS_ORIGIN` — задай, только если фронт на другом домене (иначе same-origin)

## Обновление (на каждый git pull)

```bash
git pull
bash deploy/update.sh      # npm ci + build фронта → WEB_ROOT, npm ci бэкенда, рестарт
```
`update.sh` идемпотентен; `WEB_ROOT` по умолчанию `/var/www/eilindar` (переопределяется
переменной окружения). Данные SQLite (`data/`) и `.env` он не трогает.

## Проверка

- `curl -s localhost:8787/api/health` → `{"ok":true}`
- Открыть сайт по домену; в верхней полоске вставить `API_TOKEN` (если задан) —
  статус должен стать «☁ синхронизация с сервером».

## Важное

- Репозиторий **публичный** — секретов в нём нет. `API_TOKEN` генерируется на сервере
  и в гит не коммитится (`server/.gitignore` исключает `.env` и `data/`).
- Бэкап БД: файл `DB_PATH` маленький; можно `sqlite3 <db> ".backup <path>"` по cron.
- Деплой из GitHub Actions по SSH (`.github/workflows/deploy-vps.yml`) в этой модели
  не нужен — можно игнорировать или удалить.
