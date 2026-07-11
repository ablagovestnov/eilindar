// Точка входа для GitHub Pages.
// Источник правды по коду листа — ../EilindarCharacterSheet-L5.jsx, здесь только
// монтирование и шим хранилища. Лист написан под window.storage (в артефактах
// Claude браузерное localStorage недоступно); на реальной странице подкладываем
// localStorage-совместимую реализацию того же интерфейса, чтобы работал персистенс.

import React from "react";
import { createRoot } from "react-dom/client";
import CharacterSheet from "../EilindarCharacterSheet-L5.jsx";

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? null : { value: v };
      } catch (e) {
        return null;
      }
    },
    async set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        /* приватный режим / переполнение — молча пропускаем */
      }
    },
  };
}

const root = createRoot(document.getElementById("root"));
root.render(React.createElement(CharacterSheet));
