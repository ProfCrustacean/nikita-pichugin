#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyArchitecture } from "./architecture-rules.mjs";
import { validateSiteConfig } from "./site-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = verifyArchitecture(root);
const siteConfig = JSON.parse(readFileSync(path.join(root, "src", "config", "site-config.json"), "utf8"));
const runtime = JSON.parse(readFileSync(path.join(root, "src", "generated", "site-runtime.json"), "utf8"));
const siteConfigErrors = validateSiteConfig(siteConfig, { assets: runtime.assets });

if (violations.length > 0 || siteConfigErrors.length > 0) {
  for (const violation of violations) {
    process.stderr.write(`[architecture] ${violation.file}: ${violation.rule}: ${violation.message}\n`);
  }
  for (const error of siteConfigErrors) process.stderr.write(`[architecture] ${error}\n`);
  process.exit(1);
}

process.stdout.write("[architecture] ok: module budgets, dependency boundaries, and site config are clean\n");
