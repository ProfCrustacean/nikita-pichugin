#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyArchitecture } from "./architecture-rules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = verifyArchitecture(root);

if (violations.length > 0) {
  for (const violation of violations) {
    process.stderr.write(`[architecture] ${violation.file}: ${violation.rule}: ${violation.message}\n`);
  }
  process.exit(1);
}

process.stdout.write("[architecture] ok: module budgets and dependency boundaries are clean\n");
