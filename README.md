# Эйлиндар Вэйн — интерактивный лист персонажа

Pathfinder 1e · Wizard 5 (Conjuration [Teleportation]) · кампания «Shattered Star».

## Живая страница

Собирается и публикуется автоматически через GitHub Actions при каждом пуше в
ветку по умолчанию. Адрес: `https://<owner>.github.io/eilindar/`
(для этого репозитория — `https://ablagovestnov.github.io/eilindar/`).

Данные листа хранятся в браузере (localStorage) — правки не теряются между
визитами на том же устройстве.

## CI/CD

Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml)

```
push → checkout → npm ci → npm run build → configure-pages → deploy-pages
```

Собранный бандл (`dist/`) в репозиторий **не коммитится** — его каждый раз
пересобирает CI. Источник правды по коду — только `.jsx`.

**Включение Pages (один раз):** workflow пытается включить Pages сам
(`configure-pages` с `enablement: true`). Если у токена не хватит прав, включите
вручную: Settings → Pages → Build and deployment → **Source: GitHub Actions**.
После этого каждый пуш деплоит автоматически.

## Исходники

| Файл | Назначение |
|---|---|
| `EilindarCharacterSheet-L5.jsx` | Единственный источник правды по коду листа (React-компонент) |
| `web/main.jsx` | Точка входа: монтирование + localStorage-шим для `window.storage` |
| `web/index.html` | HTML-оболочка |
| `build.mjs` | Сборка через esbuild → `dist/` (bundle + копия index.html) |

## Локальная разработка

```bash
npm install         # один раз
npm run build       # собрать в dist/
npm run check       # быстрая проверка компиляции листа (как в хэндоффе)

# предпросмотр собранной страницы
npx serve dist      # или любой статический сервер, затем открыть в браузере
```
