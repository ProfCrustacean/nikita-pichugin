import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const ARCHITECTURE_BUDGETS = Object.freeze({
  route: 180,
  featureTemplate: 190,
  featureLogic: 200,
  featureStyle: 310
});

const generatedPath = "src/generated/site-runtime.json";
const countSensitiveFiles = new Set([
  "scripts/smoke-production.mjs",
  "scripts/verify-built-site.mjs",
  "tests/e2e/catalog.spec.ts",
  "tests/e2e/responsive.spec.ts",
  "tests/e2e/smoke.spec.ts"
]);

function lineCount(source) {
  return source === "" ? 0 : source.split(/\r?\n/).length;
}

export function analyzeArchitectureFile(relativePath, source) {
  const normalized = relativePath.split(path.sep).join("/");
  const violations = [];
  const lines = lineCount(source);
  const reportSize = (limit, rule) => {
    if (lines > limit) violations.push({ file: normalized, rule, message: `${lines} lines exceeds ${limit}` });
  };

  if (/^src\/pages\/.*\.astro$/.test(normalized)) reportSize(ARCHITECTURE_BUDGETS.route, "route_size");
  if (/^src\/features\/.*\.astro$/.test(normalized)) reportSize(ARCHITECTURE_BUDGETS.featureTemplate, "feature_template_size");
  if (/^src\/features\/.*(?:controller|model|motion)\.ts$/.test(normalized)) {
    reportSize(ARCHITECTURE_BUDGETS.featureLogic, "feature_logic_size");
  }
  if (/^src\/features\/.*\.css$/.test(normalized)) reportSize(ARCHITECTURE_BUDGETS.featureStyle, "feature_style_size");

  if (/^src\/features\//.test(normalized) && /from\s+["'][^"']*pages\//.test(source)) {
    violations.push({ file: normalized, rule: "feature_imports_page", message: "features may not import route modules" });
  }
  if (/^src\/features\/.*controller\.ts$/.test(normalized)) {
    if (/from\s+["']node:/.test(source) || /from\s+["']@lib\/museum/.test(source)) {
      violations.push({ file: normalized, rule: "client_import_boundary", message: "client controllers may not import Node or museum runtime" });
    }
    if (/document\.querySelector(?:All)?\s*\(/.test(source)) {
      violations.push({ file: normalized, rule: "controller_global_query", message: "controllers must query through their root" });
    }
  }
  if (/^src\/pages\//.test(normalized) && /(?:content-export|generated\/site-runtime|\.jsonl)/.test(source)) {
    violations.push({ file: normalized, rule: "page_raw_data_import", message: "pages must use repositories, not raw catalog data" });
  }
  if (countSensitiveFiles.has(normalized) && /\b(?:87|183|270|276|295)\b/.test(source)) {
    violations.push({ file: normalized, rule: "derived_count_literal", message: "catalog counts must come from the runtime manifest" });
  }

  return violations;
}

function listSourceFiles(directory, root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute, root);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    return /\.(?:astro|css|mjs|ts)$/.test(relative) ? [relative] : [];
  });
}

export function verifyArchitecture(root) {
  const candidates = [
    ...listSourceFiles(path.join(root, "src"), root),
    ...[...countSensitiveFiles].filter((file) => file !== generatedPath)
  ];
  return [...new Set(candidates)].flatMap((file) => {
    const source = readFileSync(path.join(root, file), "utf8");
    return analyzeArchitectureFile(file, source);
  });
}
