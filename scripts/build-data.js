import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}

const manifest = readJson("data/manifest.json");

// --- Common sources (order preserved from manifest) ---
const out = {};
for (const [key, relPath] of Object.entries(manifest.sources)) {
  out[key] = readJson(relPath);
}

// --- Levels ---
const levelIndex = readJson(manifest.levels.index);
const manifestsDir = manifest.levels.manifestsDir;

const levelManifests = [];
const levelData = {};

for (const manifestFile of levelIndex.levels) {
  const levelManifest = readJson(path.join(manifestsDir, manifestFile));

  const tickets = readJson(levelManifest.tickets);
  const schema = readJson(levelManifest.schema);

  const ticketsKey = levelManifest.id === 1 ? "TICKETS" : `TICKETS_L${levelManifest.id}`;
  const schemaKey = `SCHEMA_L${levelManifest.id}`;
  out[ticketsKey] = tickets;
  out[schemaKey] = schema;

  levelManifests.push({
    id: levelManifest.id,
    title: levelManifest.title,
    desc: levelManifest.desc,
    workflow: levelManifest.workflow || null,
    queue: levelManifest.queue || null,
    intro: levelManifest.intro || null,
    workTitle: levelManifest.workTitle || null
  });
  levelData[levelManifest.id] = { tickets, schema };
}
levelManifests.sort((a, b) => a.id - b.id);

// --- Schema options validation ---
function validateSchemaOptions(name, schema) {
  if (!schema || !Array.isArray(schema.fields)) return;
  const walk = (fields) => {
    for (const f of fields) {
      if (!f) continue;
      if (f.type === "composite" && Array.isArray(f.fields)) { walk(f.fields); continue; }
      if (f.options === undefined) continue;
      if (!Array.isArray(f.options)) {
        console.warn(`⚠ ${name}: field "${f.id}" options is not an array`);
        continue;
      }
      f.options.forEach((o, i) => {
        if (typeof o === "string") return;
        if (!o || typeof o !== "object" || !("value" in o)) {
          console.warn(`⚠ ${name}: field "${f.id}" option[${i}] is neither a string nor {value,label}:`, o);
        }
      });
    }
  };
  walk(schema.fields);
}
for (const [key, schema] of Object.entries(out)) {
  if (key.startsWith("SCHEMA_")) validateSchemaOptions(key, schema);
}

// --- Emit bundle ---
const banner = "// АВТОГЕНЕРАЦИЯ! Не редактируйте этот файл руками. Меняйте JSON в папке data/ и запускайте npm run build\n";
let code = banner;

for (const [key, data] of Object.entries(out)) {
  code += `export const ${key} = ${JSON.stringify(data, null, 2)};\n\n`;
}

code += `export const LEVELS = ${JSON.stringify(levelManifests, null, 2)};\n\n`;

code += "export const LEVEL_DATA = {\n";
for (const [id] of Object.entries(levelData)) {
  const ticketsKey = String(id) === '1' ? 'TICKETS' : `TICKETS_L${id}`;
  code += `  ${id}: { tickets: ${ticketsKey}, schema: SCHEMA_L${id} },\n`;
}
code += "};\n\n";

const outPath = path.join(ROOT, manifest.output.bundle);
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, code, 'utf8');
console.log(`✅ Успешно собран: ${outPath}`);
