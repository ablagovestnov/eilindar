# Деплой на свой VPS (статика + бэкенд SQLite)

Схема: пуш → GitHub Actions собирает фронтенд → по SSH заливает статику и Node-бэкенд
на VPS → перезапускает сервис. Лист хранится в **SQLite на сервере**; localStorage в
браузере становится кэшем и оффлайн-фолбэком. Данные переживают чистку браузера и
синхронизируются между устройствами.

```
Браузер ──HTTPS──> Caddy ──/api/*──> Node (Hono) ──> SQLite (файл на диске)
                     └──всё остальное──> статика (dist/)
```

Что уже в репозитории:
- `server/` — бэкенд (Hono + better-sqlite3), API `GET/PUT /api/kv/:key`
- `web/main.jsx` — фронтенд ходит на `/api` с localStorage-фолбэком
- `.github/workflows/deploy-vps.yml` — деплой по SSH (пока ручной запуск)
- `deploy/eilindar.service` — systemd-юнит бэкенда
- `deploy/Caddyfile.example` — reverse-proxy + статика + авто-HTTPS

---

## 1. Что мне нужно от вас (чтобы финализировать)

- **Хост/IP** VPS и **SSH-порт** (если не 22)
- **SSH-пользователь** для деплоя (напр. `deploy`)
- **Домен** для сайта (для HTTPS через Caddy) — или будете по IP
- Стоит ли уже веб-сервер (Caddy / nginx) — или ставить с нуля

Пути (`/var/www/eilindar`, `/opt/eilindar-server`, порт `8787`) заданы по умолчанию —
скажите, если хотите другие.

## 2. Секреты в GitHub (добавляете вы, мне не присылать)

Settings → Secrets and variables → **Actions** → New repository secret:

| Секрет | Значение |
|---|---|
| `VPS_HOST` | IP или домен сервера |
| `VPS_USER` | SSH-пользователь для деплоя |
| `VPS_SSH_KEY` | **приватный** ключ деплоя (весь файл, целиком) |
| `VPS_PORT` | SSH-порт, если не 22 (иначе не добавляйте) |

Приватный ключ должен жить только в GitHub Secrets. Заведите **отдельную** пару
ключей для деплоя (не свой личный ключ):
```bash
ssh-keygen -t ed25519 -f deploy_key -C "gh-actions-eilindar"
# публичный deploy_key.pub → на сервер в ~deploy/.ssh/authorized_keys
# приватный deploy_key → в секрет VPS_SSH_KEY
```

## 3. Разовая подготовка сервера

```bash
# Node 20 (через nodesource или nvm) — проверьте: node -v
# отдельный пользователь для бэкенда
sudo useradd -r -m -d /opt/eilindar-server eilindar

# каталоги
sudo mkdir -p /var/www/eilindar /opt/eilindar-server/data
sudo chown -R eilindar:eilindar /opt/eilindar-server
sudo chown -R "$USER":"$USER" /var/www/eilindar   # чтобы deploy-пользователь мог писать статику

# .env бэкенда (см. server/.env.example). Обязательно задайте API_TOKEN!
sudo -u eilindar tee /opt/eilindar-server/.env >/dev/null <<'ENV'
PORT=8787
DB_PATH=/opt/eilindar-server/data/eilindar.db
API_TOKEN=ЗАМЕНИТЕ-на-длинную-случайную-строку
ENV

# systemd-сервис
sudo cp deploy/eilindar.service /etc/systemd/system/eilindar.service
sudo systemctl daemon-reload
sudo systemctl enable --now eilindar

# Caddy: поставьте домен в Caddyfile и примените
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile   # отредактируйте домен!
sudo systemctl reload caddy
```

Чтобы workflow мог перезапускать сервис без пароля — разрешите deploy-пользователю
ровно одну команду (`sudo visudo -f /etc/sudoers.d/eilindar`):
```
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart eilindar
```

## 4. Запуск деплоя

- GitHub → **Actions → Deploy to VPS → Run workflow**.
- Когда убедитесь, что всё раскатывается, включите автодеплой на пуш: в
  `.github/workflows/deploy-vps.yml` раскомментируйте блок `push:`.

## 5. Токен на фронте

Если задали `API_TOKEN`, откройте сайт → в верхней полоске нажмите **«токен»** →
вставьте тот же токен → «сохранить». Он хранится в localStorage браузера и не попадает
в публичный бандл. Без токена полоска покажет «🔒 сервер требует токен».

---

### Заметки

- **GH Pages остаётся рабочей** как версия без БД (фронт падает в localStorage). Можно
  оставить обе или отключить Pages, когда VPS заработает.
- **Бэкапы БД**: `sqlite3 /opt/eilindar-server/data/eilindar.db ".backup /path/backup.db"`
  по cron — файл маленький.
- **Конфликты**: модель «последняя запись побеждает». Для одного игрока с несколькими
  устройствами этого достаточно.
