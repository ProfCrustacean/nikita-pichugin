import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

export const DEFAULT_BASE_URL = "https://nikita-pichugin.onrender.com";
export const DEFAULT_CHANGED_FROM = "HEAD^";
export const DEFAULT_TIMEOUT_MS = 8_000;
export const REPRESENTATIVE_PATHS = ["/", "/works/", "/site/home-hero.webp", "/favicon.png"];

const SITE_WIDE_PATHS = ["/", "/works/", "/studio/", "/contact/", "/exhibitions/erzia/"];
const HTML_EXTENSIONS = new Set([".htm", ".html"]);
const PAGE_REFERENCE_RULES = new Map([
  [
    "/",
    {
      links: ["/works/", "/studio/", "/contact/", "/exhibitions/erzia/"],
      resources: ["/favicon.png", "/site/home-hero.webp"]
    }
  ],
  [
    "/works/",
    {
      links: ["/"],
      resources: ["/favicon.png", "/site/works-hero.webp"],
      linkPatterns: [/^\/works\/[^/]+\/$/],
      resourcePatterns: [/^\/museum\/previews\/[a-f0-9]{64}\.webp$/]
    }
  ],
  [
    "/archive/",
    {
      links: ["/"],
      resources: ["/favicon.png"],
      linkPatterns: [/^\/works\/[^/]+\/$/],
      resourcePatterns: [/^\/museum\/previews\/[a-f0-9]{64}\.webp$/]
    }
  ],
  [
    "/contact/",
    {
      links: ["/", "/exhibitions/erzia/"],
      resources: ["/favicon.png", "/site/contact-hero.webp"]
    }
  ],
  [
    "/studio/",
    {
      links: ["/", "/exhibitions/erzia/"],
      resources: ["/favicon.png"],
      resourcePatterns: [/^\/museum\/previews\/[a-f0-9]{64}\.webp$/]
    }
  ],
  [
    "/exhibitions/erzia/",
    {
      links: ["/"],
      resources: ["/favicon.png", "/tours/erzia-pichugin/index.html"]
    }
  ]
]);

export class SmokeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "SmokeError";
    this.code = code;
    this.details = details;
  }
}

export function parseCliArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    changedFrom: DEFAULT_CHANGED_FROM,
    expectedCommit: undefined,
    explicitPaths: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    const [flag, inlineValue] = argument.split(/=(.*)/s, 2);
    if (!["--base", "--changed-from", "--expected-commit", "--path", "--timeout"].includes(flag)) {
      throw new SmokeError("INVALID_ARGUMENT", `Unknown option: ${argument}`);
    }
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) {
      throw new SmokeError("INVALID_ARGUMENT", `Missing value for ${flag}`);
    }

    if (flag === "--base") options.baseUrl = value;
    if (flag === "--changed-from") options.changedFrom = value;
    if (flag === "--expected-commit") options.expectedCommit = value;
    if (flag === "--path") options.explicitPaths.push(value);
    if (flag === "--timeout") {
      options.timeoutMs = Number(value);
      if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 60_000) {
        throw new SmokeError("INVALID_ARGUMENT", "--timeout must be an integer between 100 and 60000 milliseconds");
      }
    }
  }

  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  return options;
}

export function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SmokeError("INVALID_BASE_URL", `Invalid base URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new SmokeError("INVALID_BASE_URL", `Base URL must be an HTTP(S) origin: ${value}`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new SmokeError("INVALID_BASE_URL", `Base URL must not contain a path, query, or fragment: ${value}`);
  }
  return url.origin;
}

export function getHeadCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

export function getChangedFiles(changedFrom = DEFAULT_CHANGED_FROM) {
  let output;
  try {
    output = execFileSync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMRTUXB", "-z", `${changedFrom}..HEAD`, "--"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (error) {
    const diagnostic = String(error?.stderr ?? "").trim();
    throw new SmokeError(
      "GIT_DIFF_FAILED",
      `Unable to compare ${changedFrom} with HEAD${diagnostic ? `: ${diagnostic}` : ""}`
    );
  }
  return output.split("\0").filter(Boolean);
}

export function changedPathsFromFiles(files) {
  const paths = new Set();

  for (const rawFile of files) {
    const file = rawFile.replaceAll("\\", "/");
    if (file.startsWith("public/") && file !== "public/health.json") {
      paths.add(normalizePath(`/${file.slice("public/".length)}`));
      if (file.startsWith("public/tours/erzia-pichugin/")) paths.add("/exhibitions/erzia/");
      continue;
    }

    if (file.startsWith("src/pages/")) {
      const route = routeFromPageFile(file);
      if (route) paths.add(route);
      continue;
    }

    if (/^(?:src\/(?:components|layouts|styles|data)\/|src\/lib\/)/.test(file)) {
      SITE_WIDE_PATHS.forEach((sitePath) => paths.add(sitePath));
      continue;
    }

    if (/^(?:content-export\/|public\/museum\/|src\/lib\/museum\.ts$)/.test(file)) {
      ["/", "/works/", "/studio/"].forEach((sitePath) => paths.add(sitePath));
    }
  }

  return [...paths].sort();
}

export function routeFromPageFile(file) {
  let route = file.replaceAll("\\", "/").replace(/^src\/pages\//, "");
  route = route.replace(/\.(?:astro|md|mdx|js|mjs|ts)$/, "");
  if (route === "404") return null;

  const segments = route.split("/");
  const dynamicIndex = segments.findIndex((segment) => segment.includes("[") || segment.includes("]"));
  if (dynamicIndex >= 0) segments.splice(dynamicIndex);
  if (segments.at(-1) === "index") segments.pop();
  if (segments.length === 0) return "/";

  const joined = `/${segments.join("/")}`;
  return path.posix.extname(joined) ? joined : `${joined}/`;
}

export function commitsMatch(expected, actual) {
  const left = String(expected ?? "").trim().toLowerCase();
  const right = String(actual ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{7,40}$/.test(left) || !/^[a-f0-9]{7,40}$/.test(right)) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

export function extractLocalReferences(html, pageUrl, baseUrl) {
  const document = load(html);
  const links = new Set();
  const resources = new Set();

  document("a[href]").each((_, element) => {
    const localPath = localPathFromReference(document(element).attr("href"), pageUrl, baseUrl);
    if (localPath) links.add(localPath);
  });

  document("img[src], script[src], iframe[src], source[src], video[src], audio[src], link[href]").each((_, element) => {
    const localPath = localPathFromReference(
      document(element).attr(element.tagName === "link" ? "href" : "src"),
      pageUrl,
      baseUrl
    );
    if (localPath) resources.add(localPath);
  });

  document("img[srcset], source[srcset]").each((_, element) => {
    for (const candidate of parseSrcset(document(element).attr("srcset") ?? "")) {
      const localPath = localPathFromReference(candidate, pageUrl, baseUrl);
      if (localPath) resources.add(localPath);
    }
  });

  return { links: [...links].sort(), resources: [...resources].sort() };
}

export function validatePageReferences(pagePath, references) {
  const rule = PAGE_REFERENCE_RULES.get(pagePath) ?? genericPageRule(pagePath);
  if (!rule) return [];

  const verified = new Set();
  for (const [kind, expected] of [
    ["links", rule.links ?? []],
    ["resources", rule.resources ?? []]
  ]) {
    for (const expectedPath of expected) {
      if (!references[kind].includes(expectedPath)) {
        throw new SmokeError(
          "MISSING_LOCAL_REFERENCE",
          `${pagePath} does not reference expected local ${kind === "links" ? "link" : "asset"} ${expectedPath}`,
          { page: pagePath, reference: expectedPath, kind }
        );
      }
      verified.add(expectedPath);
    }
  }

  for (const [kind, patterns] of [
    ["links", rule.linkPatterns ?? []],
    ["resources", rule.resourcePatterns ?? []]
  ]) {
    for (const pattern of patterns) {
      const matchedPath = references[kind].find((candidate) => pattern.test(candidate));
      if (!matchedPath) {
        throw new SmokeError(
          "MISSING_LOCAL_REFERENCE",
          `${pagePath} does not contain an expected local ${kind === "links" ? "link" : "asset"}`,
          { page: pagePath, pattern: String(pattern), kind }
        );
      }
      verified.add(matchedPath);
    }
  }

  return [...verified].sort();
}

export async function runProductionSmoke({
  baseUrl = DEFAULT_BASE_URL,
  changedFrom = DEFAULT_CHANGED_FROM,
  expectedCommit = getHeadCommit(),
  explicitPaths = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  changedFiles,
  fetchImpl = globalThis.fetch
} = {}) {
  const startedAt = Date.now();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const files = changedFiles ?? getChangedFiles(changedFrom);
  const changedPaths = changedPathsFromFiles(files);
  const normalizedExplicitPaths = explicitPaths.map((candidate) => normalizeExplicitPath(candidate, normalizedBaseUrl));
  const primaryPaths = uniqueSorted([...REPRESENTATIVE_PATHS, ...changedPaths, ...normalizedExplicitPaths]);

  const health = await fetchJson("/health.json", normalizedBaseUrl, timeoutMs, fetchImpl);
  if (health.status !== "ok") {
    throw new SmokeError("HEALTH_NOT_OK", `Production health status is ${JSON.stringify(health.status)}`);
  }
  if (!commitsMatch(expectedCommit, health.commit)) {
    throw new SmokeError(
      "COMMIT_MISMATCH",
      `Production commit ${health.commit ?? "missing"} does not match expected ${expectedCommit}`,
      { expectedCommit, deployedCommit: health.commit ?? null }
    );
  }

  const referencesToCheck = new Set();
  let pageCount = 0;
  let assetCount = 0;
  for (const primaryPath of primaryPaths) {
    if (isHtmlPagePath(primaryPath)) {
      const html = await fetchText(primaryPath, normalizedBaseUrl, timeoutMs, fetchImpl);
      const references = extractLocalReferences(html, new URL(primaryPath, normalizedBaseUrl), normalizedBaseUrl);
      validatePageReferences(primaryPath, references).forEach((reference) => referencesToCheck.add(reference));
      pageCount += 1;
    } else {
      await probePath(primaryPath, normalizedBaseUrl, timeoutMs, fetchImpl);
      assetCount += 1;
    }
  }

  const referencePaths = uniqueSorted(
    [...referencesToCheck].filter((reference) => !primaryPaths.includes(reference) && reference !== "/health.json")
  );
  await runWithConcurrency(referencePaths, 8, (reference) =>
    probePath(reference, normalizedBaseUrl, timeoutMs, fetchImpl)
  );

  return {
    status: "ok",
    base: normalizedBaseUrl,
    expectedCommit,
    deployedCommit: health.commit,
    changedFrom,
    changedFiles: files.length,
    changedPaths,
    explicitPaths: normalizedExplicitPaths,
    checks: {
      health: 1,
      pages: pageCount,
      assets: assetCount,
      localReferences: referencePaths.length,
      requests: 1 + primaryPaths.length + referencePaths.length
    },
    durationMs: Date.now() - startedAt
  };
}

async function fetchJson(requestPath, baseUrl, timeoutMs, fetchImpl) {
  const text = await fetchText(requestPath, baseUrl, timeoutMs, fetchImpl);
  try {
    return JSON.parse(text);
  } catch {
    throw new SmokeError("INVALID_JSON", `${requestPath} did not return valid JSON`, { path: requestPath });
  }
}

async function fetchText(requestPath, baseUrl, timeoutMs, fetchImpl) {
  const response = await request(requestPath, baseUrl, { method: "GET" }, timeoutMs, fetchImpl);
  assertSuccessfulResponse(response, requestPath);
  const text = await response.text();
  if (!text.trim()) throw new SmokeError("EMPTY_RESPONSE", `${requestPath} returned an empty response`, { path: requestPath });
  return text;
}

async function probePath(requestPath, baseUrl, timeoutMs, fetchImpl) {
  let response = await request(requestPath, baseUrl, { method: "HEAD" }, timeoutMs, fetchImpl);
  if ([405, 501].includes(response.status)) {
    response = await request(
      requestPath,
      baseUrl,
      { method: "GET", headers: { Range: "bytes=0-0" } },
      timeoutMs,
      fetchImpl
    );
  }
  assertSuccessfulResponse(response, requestPath);
  if (response.headers.get("content-length") === "0") {
    throw new SmokeError("EMPTY_RESPONSE", `${requestPath} returned an empty response`, { path: requestPath });
  }
  await response.body?.cancel().catch(() => {});
}

async function request(requestPath, baseUrl, init, timeoutMs, fetchImpl) {
  const url = new URL(requestPath, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, redirect: "follow", signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new SmokeError("REQUEST_TIMEOUT", `${url.pathname} exceeded ${timeoutMs}ms`, {
        path: url.pathname,
        timeoutMs
      });
    }
    throw new SmokeError("REQUEST_FAILED", `${url.pathname} failed: ${error?.message ?? error}`, {
      path: url.pathname
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assertSuccessfulResponse(response, requestPath) {
  if (!response.ok) {
    throw new SmokeError("HTTP_STATUS", `${requestPath} returned HTTP ${response.status}`, {
      path: requestPath,
      status: response.status
    });
  }
}

function normalizeExplicitPath(value, baseUrl) {
  let url;
  try {
    url = new URL(value.startsWith("/") ? value : `/${value}`, baseUrl);
  } catch {
    throw new SmokeError("INVALID_PATH", `Invalid --path value: ${value}`);
  }
  if (url.origin !== baseUrl) {
    throw new SmokeError("INVALID_PATH", `--path must point to ${baseUrl}: ${value}`);
  }
  return normalizePath(`${url.pathname}${url.search}`);
}

function normalizePath(value) {
  const url = new URL(value, "https://local.invalid");
  return `${url.pathname}${url.search}`;
}

function localPathFromReference(value, pageUrl, baseUrl) {
  if (!value || /^(?:data|blob|mailto|tel|javascript):/i.test(value)) return null;
  let url;
  try {
    url = new URL(value, pageUrl);
  } catch {
    return null;
  }
  if (url.origin !== baseUrl) return null;
  return normalizePath(`${url.pathname}${url.search}`);
}

function parseSrcset(value) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter(Boolean);
}

function genericPageRule(pagePath) {
  if (pagePath.startsWith("/tours/") || pagePath === "/") return null;
  return { links: ["/"], resources: ["/favicon.png"] };
}

function isHtmlPagePath(requestPath) {
  const pathname = new URL(requestPath, "https://local.invalid").pathname;
  return pathname === "/" || pathname.endsWith("/") || HTML_EXTENSIONS.has(path.posix.extname(pathname));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

async function runWithConcurrency(items, limit, worker) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function usage() {
  return [
    "Usage: node scripts/smoke-production.mjs [options]",
    "  --base <url>             Production origin (default: Render site)",
    "  --changed-from <ref>     Git ref to compare with HEAD (default: HEAD^)",
    "  --expected-commit <sha>  Expected deployed commit (default: git rev-parse HEAD)",
    "  --path <path>            Additional path to check; repeatable",
    "  --timeout <ms>           Per-request timeout, 100..60000 (default: 8000)"
  ].join("\n");
}

async function main() {
  const startedAt = Date.now();
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    const result = await runProductionSmoke(options);
    console.log(JSON.stringify(result));
  } catch (error) {
    const failure = {
      status: "error",
      code: error instanceof SmokeError ? error.code : "UNEXPECTED_ERROR",
      message: error?.message ?? String(error),
      ...(error instanceof SmokeError && Object.keys(error.details).length > 0 ? { details: error.details } : {}),
      durationMs: Date.now() - startedAt
    };
    console.error(JSON.stringify(failure));
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
