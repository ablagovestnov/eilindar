#!/usr/bin/env bash
# Разовая настройка VPS под лист Эйлиндара. Ubuntu/Debian, systemd, apt.
# Делает: ставит Node (если нет), создаёт каталоги, .env со случайным токеном,
# systemd-сервис, правило sudo для рестарта и (опционально) Caddy с авто-HTTPS.
#
# Запуск от root на самом сервере:
#   sudo bash bootstrap.sh --user deploy \
#        [--domain eilindar.example.com] \
#        [--pubkey "ssh-ed25519 AAAA... gh-actions-eilindar"]
#
# --user   обязателен: SSH-пользователь, под которым идёт деплой (должен уже существовать).
# --domain опционален: если задан — ставит и настраивает Caddy (HTTPS) на этот домен.
# --pubkey опционален: публичный ключ deploy-пары → в authorized_keys пользователя.
set -euo pipefail

WEB_ROOT=/var/www/eilindar
APP_DIR=/opt/eilindar-server
SVC_PORT=8787
DEPLOY_USER=""
DOMAIN=""
PUBKEY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --user)   DEPLOY_USER="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}";      shift 2 ;;
    --pubkey) PUBKEY="${2:-}";      shift 2 ;;
    *) echo "неизвестный аргумент: $1"; exit 1 ;;
  esac
done

[ "$(id -u)" = "0" ] || { echo "Запускать от root: sudo bash bootstrap.sh …"; exit 1; }
[ -n "$DEPLOY_USER" ] || { echo "Укажите --user <deploy-пользователь>"; exit 1; }
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "Пользователь '$DEPLOY_USER' не найден — создайте его сначала (напр. adduser $DEPLOY_USER)"; exit 1; }

echo "== базовые пакеты =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg openssl rsync >/dev/null

echo "== Node =="
if ! command -v node >/dev/null 2>&1; then
  echo "  ставлю Node 20 (NodeSource)…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "  node $(node -v)"

echo "== каталоги =="
mkdir -p "$WEB_ROOT" "$APP_DIR/data"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$WEB_ROOT" "$APP_DIR"

echo "== .env =="
NEW_TOKEN=""
if [ ! -f "$APP_DIR/.env" ]; then
  NEW_TOKEN="$(openssl rand -hex 24)"
  cat > "$APP_DIR/.env" <<ENV
PORT=$SVC_PORT
DB_PATH=$APP_DIR/data/eilindar.db
API_TOKEN=$NEW_TOKEN
ENV
  chown "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "  создан $APP_DIR/.env с новым токеном"
else
  echo "  $APP_DIR/.env уже существует — не трогаю"
fi

if [ -n "$PUBKEY" ]; then
  echo "== ключ деплоя =="
  HOME_DIR="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$HOME_DIR/.ssh"
  touch "$HOME_DIR/.ssh/authorized_keys"
  grep -qxF "$PUBKEY" "$HOME_DIR/.ssh/authorized_keys" || echo "$PUBKEY" >> "$HOME_DIR/.ssh/authorized_keys"
  chown "$DEPLOY_USER":"$DEPLOY_USER" "$HOME_DIR/.ssh/authorized_keys"
  chmod 600 "$HOME_DIR/.ssh/authorized_keys"
  echo "  ключ добавлен в authorized_keys пользователя $DEPLOY_USER"
fi

echo "== systemd-сервис =="
cat > /etc/systemd/system/eilindar.service <<UNIT
[Unit]
Description=Eilindar character sheet backend (Hono + better-sqlite3)
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$(command -v node) index.mjs
Restart=on-failure
RestartSec=3
User=$DEPLOY_USER
Group=$DEPLOY_USER

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable eilindar >/dev/null 2>&1 || true
echo "  сервис eilindar включён (поднимется после первого деплоя, когда приедет код)"

echo "== sudoers: рестарт без пароля =="
echo "$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart eilindar" > /etc/sudoers.d/eilindar
chmod 440 /etc/sudoers.d/eilindar
visudo -cf /etc/sudoers.d/eilindar >/dev/null
echo "  ok"

if [ -n "$DOMAIN" ]; then
  echo "== Caddy =="
  if ! command -v caddy >/dev/null 2>&1; then
    echo "  ставлю Caddy…"
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy >/dev/null
  fi
  cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    encode gzip
    handle /api/* {
        reverse_proxy localhost:$SVC_PORT
    }
    handle {
        root * $WEB_ROOT
        try_files {path} /index.html
        file_server
    }
}
CADDY
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
  echo "  Caddy настроен на $DOMAIN (HTTPS выпустится автоматически)"
fi

echo
echo "======================================================================"
echo " Готово. Осталось:"
echo "   1) Секреты в GitHub: VPS_HOST, VPS_USER=$DEPLOY_USER, VPS_SSH_KEY"
echo "   2) Actions → Deploy to VPS → Run workflow"
if [ -n "$NEW_TOKEN" ]; then
  echo "   3) API_TOKEN (вписать в браузере в полоске «токен»):"
  echo "        $NEW_TOKEN"
fi
echo "======================================================================"
