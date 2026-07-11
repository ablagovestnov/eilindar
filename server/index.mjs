// Бэкенд листа персонажа Эйлиндар.
// Hono + better-sqlite3. Хранит документы как key/value (тот же интерфейс,
// что у window.storage на фронте): GET/PUT /api/kv/:key.
//
// Переменные окружения:
//   PORT       — порт (по умолчанию 8787)
//   DB_PATH    — путь к файлу SQLite (по умолчанию ./data/eilindar.db)
//   API_TOKEN  — если задан, запросы к /api/* требуют заголовок
//                Authorization: Bearer <token>. Пусто = без авторизации.
//   CORS_ORIGIN — если фронт на другом домене, укажите его (по умолчанию same-origin).

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PORT = Number(process.env.PORT) || 8787;
const DB_PATH = process.env.DB_PATH || "./data/eilindar.db";
const API_TOKEN = process.env.API_TOKEN || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const selectStmt = db.prepare("SELECT value, updated_at FROM documents WHERE key = ?");
const upsertStmt = db.prepare(`
  INSERT INTO documents (key, value, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
`);

const app = new Hono();

if (CORS_ORIGIN) app.use("/api/*", cors({ origin: CORS_ORIGIN }));

// Необязательная bearer-авторизация
app.use("/api/*", async (c, next) => {
  if (API_TOKEN) {
    const auth = c.req.header("authorization") || "";
    if (auth !== `Bearer ${API_TOKEN}`) return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/kv/:key", (c) => {
  const row = selectStmt.get(c.req.param("key"));
  if (!row) return c.json({ value: null });
  return c.json({ value: row.value, updatedAt: row.updated_at });
});

app.put("/api/kv/:key", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.value !== "string") {
    return c.json({ error: "value (string) required" }, 400);
  }
  upsertStmt.run(c.req.param("key"), body.value);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: PORT });
console.log(`eilindar backend слушает :${PORT}, БД ${DB_PATH}${API_TOKEN ? " (токен включён)" : ""}`);
