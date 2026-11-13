import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}
function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

const manifest = readJson("data/manifest.json");
const themePath = manifest.themes.default;
const sourcePath = manifest.css.source;
const outPath = manifest.output.css;

const theme = readJson(themePath);
if (!theme || !theme.tokens || typeof theme.tokens !== "object") {
  console.error(`❌ ${themePath}: missing "tokens" object`);
  process.exit(1);
}

const sourceCss = readText(sourcePath).trim();

// Tokens must live only in the theme file. If a `:root` block
// reappears in the source CSS, warn — two sources of truth is
// a bug, not a feature.
if (/:root\s*\{/.test(sourceCss)) {
  console.warn(`⚠ ${sourcePath} contains ":root" — tokens should live only in ${themePath}`);
}

const tokenLines = Object.entries(theme.tokens)
  .map(([name, value]) => `  --${name}: ${value};`)
  .join("\n");
const rootBlock = `:root {\n${tokenLines}\n}`;

const indented = sourceCss
  .split("\n")
  .map((line) => (line.length > 0 ? "  " + line : line))
  .join("\n");
const layerBlock = `@layer ludus.components {\n${indented}\n}`;

const banner =
  "/* АВТОГЕНЕРАЦИЯ! Не редактируйте этот файл руками. " +
  `Меняйте ${themePath} и ${sourcePath}, запускайте npm run build */\n\n`;

const out = banner + rootBlock + "\n\n" + layerBlock + "\n";

const outFile = path.join(ROOT, outPath);
const outDir = path.dirname(outFile);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, out, "utf8");

const tokenCount = Object.keys(theme.tokens).length;
console.log(`✅ CSS собран: ${outFile} (${tokenCount} токенов)`);
