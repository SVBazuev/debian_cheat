import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}
function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function validateTemplate(id, html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  const body = dom.window.document.body;
  if (body.children.length === 0) {
    console.warn(`⚠ template '${id}': no root element`);
    return false;
  }
  if (body.children.length > 1) {
    console.warn(`⚠ template '${id}': multiple root elements (${body.children.length})`);
    return false;
  }
  const seen = new Set();
  for (const el of body.querySelectorAll("[data-slot]")) {
    const s = el.getAttribute("data-slot");
    if (seen.has(s)) console.warn(`⚠ template '${id}': duplicate data-slot '${s}'`);
    seen.add(s);
  }
  return true;
}

const manifest = readJson("data/manifest.json");
const indexPath = manifest.templates.index;
const indexDir = path.dirname(indexPath);
const index = readJson(indexPath);

const out = {};
for (const [id, relFromIndex] of Object.entries(index)) {
  const fullRel = path.posix.join(indexDir, relFromIndex);
  const html = readText(fullRel).trim();
  if (!html) {
    console.warn(`⚠ template '${id}': empty file (${fullRel})`);
    continue;
  }
  validateTemplate(id, html);
  out[id] = html;
}

const banner = "// АВТОГЕНЕРАЦИЯ! Не редактируйте этот файл руками. Меняйте HTML в папке templates/ и запускайте npm run build\n";
let code = banner;
code += `export const templates = ${JSON.stringify(out, null, 2)};\n`;

const outPath = path.join(ROOT, manifest.output.templates);
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, code, "utf8");
console.log(`✅ Шаблоны собраны: ${outPath} (${Object.keys(out).length} шт.)`);
