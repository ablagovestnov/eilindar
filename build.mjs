// Сборка страницы для GitHub Pages.
// Источник правды по коду листа — EilindarCharacterSheet-L5.jsx.
// Результат кладётся в dist/ (в гит не коммитится; собирается в CI при деплое).

import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["web/main.jsx"],
  bundle: true,
  minify: true,
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: "dist/app.js",
});

copyFileSync("web/index.html", "dist/index.html");

console.log("✓ собрано в dist/ (index.html + app.js)");
