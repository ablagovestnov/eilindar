#!/usr/bin/env bash
# Повторяемый деплой НА сервере (запускать в каталоге репозитория, после git pull).
# Разовую инфраструктуру ставит deploy/bootstrap.sh; этот скрипт — пересборка и рестарт.
#
#   cd /path/to/eilindar && git pull && bash deploy/update.sh
#
# Переменные окружения (необязательно):
#   WEB_ROOT — куда класть статику для веб-сервера (по умолчанию /var/www/eilindar)
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/var/www/eilindar}"

echo "== сборка фронтенда =="
npm ci
npm run build

echo "== публикация статики в $WEB_ROOT =="
mkdir -p "$WEB_ROOT"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete dist/ "$WEB_ROOT/"
else
  rm -rf "${WEB_ROOT:?}/"* && cp -r dist/. "$WEB_ROOT/"
fi

echo "== зависимости бэкенда =="
( cd server && npm ci --omit=dev )

echo "== рестарт сервиса =="
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^eilindar\.service'; then
  sudo systemctl restart eilindar
  echo "  eilindar перезапущен"
else
  echo "  systemd-сервис eilindar не найден — перезапустите бэкенд своим менеджером процессов"
  echo "  (запуск вручную: cd server && node index.mjs, читает server/.env)"
fi

echo "готово."
