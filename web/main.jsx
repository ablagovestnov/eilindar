// Точка входа. Источник правды по коду листа — ../EilindarCharacterSheet-L5.jsx.
// Здесь: (1) шим window.storage поверх серверного API с localStorage-кэшем и
// fallback'ом, (2) тонкая полоска статуса синка + поле токена, (3) монтирование.
//
// Один и тот же бандл работает в двух местах:
//   • на VPS  — Caddy отдаёт статику и проксирует /api → Node-бэкенд (SQLite);
//   • на GH Pages — /api нет, всё падает в localStorage (как раньше).

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import CharacterSheet from "../EilindarCharacterSheet-L5.jsx";

const API_BASE = "";                     // same-origin: ищем /api на этом же домене
const TOKEN_KEY = "eilindar:apiToken";

const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
const authHeaders = () => { const t = getToken(); return t ? { authorization: `Bearer ${t}` } : {}; };

// Доступность сервера проверяем один раз и кэшируем
let serverState = null; // null = ещё не знаем; true/false
async function serverAvailable() {
  if (serverState !== null) return serverState;
  try {
    const r = await fetch(`${API_BASE}/api/health`, { headers: authHeaders() });
    serverState = r.ok;
  } catch { serverState = false; }
  return serverState;
}

const localGet = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : { value: v }; } catch { return null; } };
const localSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

if (typeof window !== "undefined") {
  window.storage = {
    async get(key) {
      if (await serverAvailable()) {
        try {
          const r = await fetch(`${API_BASE}/api/kv/${encodeURIComponent(key)}`, { headers: authHeaders() });
          if (r.ok) {
            const d = await r.json();
            if (d && typeof d.value === "string") { localSet(key, d.value); return { value: d.value }; }
            // На сервере пусто — засеваем его локальными данными, если они есть
            const loc = localGet(key);
            if (loc) this.set(key, loc.value);
            return loc;
          }
        } catch { /* сеть моргнула — падаем в локальный кэш */ }
      }
      return localGet(key);
    },
    async set(key, value) {
      localSet(key, value); // всегда держим локальную копию как кэш
      if (await serverAvailable()) {
        try {
          await fetch(`${API_BASE}/api/kv/${encodeURIComponent(key)}`, {
            method: "PUT",
            headers: { "content-type": "application/json", ...authHeaders() },
            body: JSON.stringify({ value }),
          });
        } catch { /* оффлайн — данные остались в localStorage, догонят позже */ }
      }
    },
  };
}

// ---- тонкая полоска статуса синка + поле токена ----

function SyncBar() {
  const [status, setStatus] = useState("checking"); // checking|server|local|auth
  const [token, setToken] = useState(getToken());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/health`, { headers: authHeaders() });
        if (!alive) return;
        setStatus(r.ok ? "server" : (r.status === 401 ? "auth" : "local"));
      } catch { if (alive) setStatus("local"); }
    })();
    return () => { alive = false; };
  }, []);

  const save = () => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
    location.reload(); // перечитать лист с сервера под новым токеном
  };

  const meta = {
    checking: ["#8a7a5a", "проверяю сервер…"],
    server:   ["#2e7d32", "☁ синхронизация с сервером (SQLite)"],
    local:    ["#8a6d3b", "⛶ локально — сервер недоступен, данные только в этом браузере"],
    auth:     ["#b00020", "🔒 сервер требует токен — введите его справа"],
  }[status];

  return (
    <div style={{
      maxWidth: 1240, margin: "0 auto 8px", padding: "5px 12px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      background: "#fbf3df", border: "1px solid #c9a876", borderRadius: 4,
      fontFamily: "'EB Garamond', Georgia, serif", fontSize: 12,
    }}>
      <span style={{ color: meta[0], fontWeight: 600 }}>{meta[1]}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => setOpen(o => !o)} style={{
          background: "transparent", border: "1px solid #c9a876", borderRadius: 2,
          padding: "2px 8px", cursor: "pointer", color: "#7a3c1a", fontSize: 11,
        }}>{open ? "скрыть" : "токен"}</button>
        {open && (
          <>
            <input type="password" value={token} placeholder="API-токен (если задан на сервере)"
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              style={{ width: 240, padding: "3px 6px", border: "1px solid #c9a876", borderRadius: 2, fontSize: 12 }} />
            <button onClick={save} style={{
              background: "#2f4a2a", color: "#fff", border: "none", borderRadius: 2,
              padding: "3px 10px", cursor: "pointer", fontSize: 11,
            }}>сохранить</button>
          </>
        )}
      </div>
    </div>
  );
}

function Root() {
  return <><SyncBar /><CharacterSheet /></>;
}

createRoot(document.getElementById("root")).render(<Root />);
