#!/usr/bin/env node
/**
 * bin/ludus.js — Ludus build orchestrator (packager).
 *
 * Reads ludus.config.json, runs the build-time assembly steps
 * (build-data.js, build-templates.js, build-css.js), then packs
 * the resulting artifacts together with @ludus/core and the app
 * code into dist/<app>/ — a single deployable directory.
 *
 * Usage:
 *   node bin/ludus.js build [--config ludus.config.json]
 *   npm run build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ASSEMBLY_SCRIPTS = [
  "build-data.js",
  "build-templates.js",
  "build-css.js"
];

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}

function ensureCleanDir(absPath) {
  if (fs.existsSync(absPath)) {
    fs.rmSync(absPath, { recursive: true, force: true });
  }
  fs.mkdirSync(absPath, { recursive: true });
}

function copyRecursive(src, dst) {
  const srcAbs = path.resolve(src);
  const dstAbs = path.resolve(dst);
  // Guard: refuse to copy a directory into itself or a descendant.
  if (dstAbs === srcAbs || dstAbs.startsWith(srcAbs + path.sep)) {
    throw new Error(`copyRecursive: refusing to copy '${srcAbs}' into '${dstAbs}'`);
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config") {
      result.config = argv[++i];
    } else if (arg.startsWith("--config=")) {
      result.config = arg.split("=").slice(1).join("=");
    } else if (arg.startsWith("--")) {
      result[arg.slice(2)] = true;
    } else {
      result._.push(arg);
    }
  }
  return result;
}

function validateConfig(config) {
  const required = ["app", "data", "templates", "theme", "css", "core", "output"];
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`ludus.config.json: missing "${key}" section`);
    }
  }
  const entryPath = path.join(ROOT, config.app.entry);
  if (!fs.existsSync(entryPath)) {
    throw new Error(`ludus.config.json: entry not found at "${config.app.entry}"`);
  }
  const indexPath = path.join(ROOT, config.app.index);
  if (!fs.existsSync(indexPath)) {
    throw new Error(`ludus.config.json: index template not found at "${config.app.index}"`);
  }
  const corePath = path.join(ROOT, config.core.package);
  if (!fs.existsSync(corePath)) {
    throw new Error(`ludus.config.json: core package not found at "${config.core.package}"`);
  }
}

function runAssembly() {
  console.log("[ludus] Assembly: data, templates, css");
  for (const script of ASSEMBLY_SCRIPTS) {
    const scriptPath = path.join(ROOT, "scripts", script);
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: "inherit"
    });
    if (result.status !== 0) {
      throw new Error(`Assembly step failed: ${script} (exit ${result.status})`);
    }
  }
}

function runPackage(config) {
  const outDir = path.join(ROOT, config.output);
  console.log(`[ludus] Package: ${config.output}`);
  ensureCleanDir(outDir);

  // 1. Build artifacts: build/* → dist/<app>/build/*
  // build/ and dist/ are distinct namespaces, so no risk of
  // recursing into the output dir; copy verbatim.
  const rootBuild = path.join(ROOT, "build");
  if (!fs.existsSync(rootBuild)) {
    throw new Error(`Assembly produced no build/ directory`);
  }
  copyRecursive(rootBuild, path.join(outDir, "build"));

  // 2. App code: js/ → dist/<app>/js/
  copyRecursive(path.join(ROOT, "js"), path.join(outDir, "js"));

  // 3. Core runtime: packages/@ludus/js/ → dist/<app>/packages/@ludus/js/
  copyRecursive(
    path.join(ROOT, config.core.package, "js"),
    path.join(outDir, config.core.package, "js")
  );

  // 4. index.html — copied verbatim; import map and relative paths
  //    resolve inside dist/<app>/ because the layout is preserved.
  fs.copyFileSync(
    path.join(ROOT, config.app.index),
    path.join(outDir, "index.html")
  );

  console.log(`✅ Packaged: ${path.relative(ROOT, outDir)}`);
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const command = args._[0];

  if (command !== "build") {
    console.error("Usage: node bin/ludus.js build [--config ludus.config.json]");
    process.exit(1);
  }

  const configPath = args.config || "ludus.config.json";
  const config = readJson(configPath);
  validateConfig(config);

  runAssembly();
  runPackage(config);
}

try {
  main();
} catch (err) {
  console.error(`❌ ludus: ${err.message}`);
  process.exit(1);
}
