import { execFileSync } from "node:child_process";

const SCOPE = Object.freeze({
  FAST: "fast",
  STANDARD: "standard",
  RELEASE: "release"
});

const releasePrefixes = [
  ".github/",
  "content-export/",
  "content/",
  "public/museum/",
  "public/tours/",
  "scripts/",
  "src/domain/catalog/",
  "src/generated/",
  "src/lib/museum/",
  "src/lib/tour/"
];

const releaseFiles = new Set([
  ".node-version",
  ".nvmrc",
  "Dockerfile",
  "Procfile",
  "astro.config.mjs",
  "astro.config.ts",
  "bun.lock",
  "bun.lockb",
  "deno.json",
  "deno.lock",
  "netlify.toml",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "package.json",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.ts",
  "pnpm-lock.yaml",
  "public/health.json",
  "render.yaml",
  "render.yml",
  "src/lib/museum.ts",
  "tsconfig.json",
  "vercel.json",
  "yarn.lock"
]);

const standardPrefixes = [
  "src/pages/",
  "src/components/",
  "src/features/",
  "src/styles/",
  "src/layouts/",
  "src/config/",
  "src/lib/"
];
const standardFiles = new Set();
const fastPrefixes = ["docs/", "tests/"];
const documentationNames = /^(?:AGENTS|CHANGELOG|CONTRIBUTING|LICENSE|README)(?:\.[^/]+)?$/i;
const buildConfigPattern = /^(?:vite|vitest)\.config\.(?:c|m)?[jt]s$/;
const extendedTsConfigPattern = /^tsconfig(?:\.[^/]+)?\.json$/;

export function normalizeChangedPath(filePath) {
  return String(filePath).trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

export function classifyChangedPath(filePath) {
  const path = normalizeChangedPath(filePath);

  if (
    releaseFiles.has(path) ||
    releasePrefixes.some((prefix) => path.startsWith(prefix)) ||
    buildConfigPattern.test(path) ||
    extendedTsConfigPattern.test(path)
  ) {
    return { path, scope: SCOPE.RELEASE, category: "release_sensitive" };
  }

  if (standardFiles.has(path) || standardPrefixes.some((prefix) => path.startsWith(prefix))) {
    return { path, scope: SCOPE.STANDARD, category: "site_runtime" };
  }

  const baseName = path.split("/").at(-1) ?? path;
  if (
    fastPrefixes.some((prefix) => path.startsWith(prefix)) ||
    path.endsWith(".md") ||
    documentationNames.test(baseName)
  ) {
    return { path, scope: SCOPE.FAST, category: "tests_or_docs" };
  }

  return { path, scope: SCOPE.RELEASE, category: "unknown_fallback" };
}

export function classifyChangeSet(filePaths) {
  const changedFiles = [...new Set(filePaths.map(normalizeChangedPath).filter(Boolean))].sort();
  const classifications = changedFiles.map(classifyChangedPath);

  if (classifications.length === 0) {
    return {
      scope: SCOPE.FAST,
      reason: "no_changes",
      changedFiles,
      classifications
    };
  }

  if (classifications.some(({ category }) => category === "unknown_fallback")) {
    return {
      scope: SCOPE.RELEASE,
      reason: "unknown_path",
      changedFiles,
      classifications
    };
  }

  const runtimeScopes = new Set(
    classifications.map(({ scope }) => scope).filter((scope) => scope !== SCOPE.FAST)
  );
  if (runtimeScopes.size > 1) {
    return {
      scope: SCOPE.RELEASE,
      reason: "mixed_scopes",
      changedFiles,
      classifications
    };
  }

  const [scope = SCOPE.FAST] = runtimeScopes;
  return {
    scope,
    reason: `${scope}_changes`,
    changedFiles,
    classifications
  };
}

function readNullSeparatedGitPaths(repositoryRoot, args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })
    .split("\0")
    .filter(Boolean);
}

export function findRepositoryRoot(cwd = process.cwd()) {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

export function getWorkingTreeChanges(cwd = process.cwd()) {
  const repositoryRoot = findRepositoryRoot(cwd);
  const tracked = readNullSeparatedGitPaths(repositoryRoot, [
    "diff",
    "--name-only",
    "--no-renames",
    "--diff-filter=ACDMRTUXB",
    "-z",
    "HEAD",
    "--"
  ]);
  const untracked = readNullSeparatedGitPaths(repositoryRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
    "--"
  ]);

  return {
    repositoryRoot,
    changedFiles: [...new Set([...tracked, ...untracked].map(normalizeChangedPath))].sort()
  };
}

export { SCOPE };
