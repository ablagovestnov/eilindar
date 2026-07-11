# Эйлиндар Вэйн — интерактивный лист персонажа

Pathfinder 1e · Wizard 5 (Conjuration [Teleportation]) · кампания «Shattered Star».

## Живая страница

Публикуется через GitHub Pages из папки [`docs/`](docs/). После включения Pages
адрес будет вида `https://<owner>.github.io/eilindar/`.

**Как включить (один раз, в настройках репозитория):**
Settings → Pages → Build and deployment → Source: **Deploy from a branch** →
Branch: `claude/eilindar-character-handoff-h1btoi`, папка **`/docs`** → Save.

Через ~1 минуту страница станет доступна. Данные листа сохраняются в браузере
(localStorage) — правки не теряются между визитами на том же устройстве.

## Исходники

| Файл | Назначение |
|---|---|
| `EilindarCharacterSheet-L5.jsx` | Единственный источник правды по коду листа (React-компонент) |
| `web/main.jsx` | Точка входа для страницы: монтирование + localStorage-шим для `window.storage` |
| `docs/index.html` | HTML-оболочка |
| `docs/app.js` | Собранный бандл (генерируется, не редактировать вручную) |

## Пересборка страницы

После правок в `EilindarCharacterSheet-L5.jsx`:

```bash
npm install      # один раз
npm run build    # пересобирает docs/app.js
npm run check    # быстрая проверка компиляции листа (как в хэндоффе)
```

Затем закоммить обновлённый `docs/app.js`.
