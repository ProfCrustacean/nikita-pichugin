#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatRenderBlueprint } from "./render-blueprint.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = path.join(root, "src", "generated", "site-runtime.json");
const renderPath = path.join(root, "render.yaml");
const check = process.argv.includes("--check");
const invalid = process.argv.slice(2).filter((argument) => argument !== "--check" && argument !== "--write");
if (invalid.length > 0) throw new Error(`Unsupported argument: ${invalid.join(", ")}`);

const runtime = JSON.parse(await readFile(runtimePath, "utf8"));
const expected = formatRenderBlueprint(runtime.legacyRedirects);

if (check) {
  const actual = await readFile(renderPath, "utf8");
  if (actual !== expected) {
    process.stderr.write("[render] render.yaml is stale; run npm run render:sync\n");
    process.exit(1);
  }
  process.stdout.write(`[render] ok: ${runtime.legacyRedirects.length} generated redirects\n`);
} else {
  await writeFile(renderPath, expected);
  process.stdout.write(`[render] wrote ${runtime.legacyRedirects.length} redirects\n`);
}
