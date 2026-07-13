import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  SmokeError,
  changedPathsFromFiles,
  commitsMatch,
  parseCliArgs,
  runProductionSmoke,
  validatePageReferences
} from "../scripts/smoke-production.mjs";

const openServers = new Set();

afterEach(async () => {
  await Promise.all([...openServers].map((server) => new Promise((resolve) => server.close(resolve))));
  openServers.clear();
});

describe("production smoke helpers", () => {
  it("maps changed files to deterministic production paths", () => {
    expect(
      changedPathsFromFiles([
        "src/pages/contact/index.astro",
        "src/pages/works/[catalog].astro",
        "public/site/contact-hero.webp",
        "tests/smoke-production.test.mjs"
      ])
    ).toEqual(["/contact/", "/site/contact-hero.webp", "/works/"]);
  });

  it("routes shared UI changes through representative site pages", () => {
    expect(changedPathsFromFiles(["src/components/SundayHeader.astro"])).toEqual([
      "/",
      "/contact/",
      "/exhibitions/erzia/",
      "/studio/",
      "/works/"
    ]);
  });

  it("accepts repeatable paths and abbreviated matching commits", () => {
    const options = parseCliArgs([
      "--base",
      "https://example.test",
      "--path",
      "/contact/",
      "--path=/site/contact-hero.webp",
      "--timeout=1500"
    ]);
    expect(options.explicitPaths).toEqual(["/contact/", "/site/contact-hero.webp"]);
    expect(options.timeoutMs).toBe(1500);
    expect(commitsMatch("abcdef1234567890", "abcdef1")).toBe(true);
    expect(commitsMatch("abcdef1234567890", "1234567")).toBe(false);
  });

  it("fails when a page omits a required local reference", () => {
    expect(() =>
      validatePageReferences("/contact/", {
        links: ["/"],
        resources: ["/favicon.png", "/site/contact-hero.webp"]
      })
    ).toThrow(SmokeError);
  });
});

describe("production smoke fixture", () => {
  it("checks health, changed pages, representative assets, and local references", async () => {
    const fixture = await startFixture({ commit: "abcdef1" });
    const result = await runProductionSmoke({
      baseUrl: fixture.baseUrl,
      expectedCommit: "abcdef1234567890",
      changedFiles: ["src/pages/contact/index.astro"],
      timeoutMs: 1_000
    });

    expect(result.status).toBe("ok");
    expect(result.changedPaths).toEqual(["/contact/"]);
    expect(result.checks.pages).toBe(3);
    expect(fixture.requests).toContain("GET /health.json");
    expect(fixture.requests).toContain("GET /contact/");
    expect(fixture.requests).toContain("HEAD /site/contact-hero.webp");
    expect(fixture.requests).toContain("HEAD /works/sample-work/");
  });

  it("fails on a deployed commit mismatch", async () => {
    const fixture = await startFixture({ commit: "1234567" });
    await expect(
      runProductionSmoke({
        baseUrl: fixture.baseUrl,
        expectedCommit: "abcdef1234567890",
        changedFiles: [],
        timeoutMs: 1_000
      })
    ).rejects.toMatchObject({ code: "COMMIT_MISMATCH" });
  });
});

async function startFixture({ commit }) {
  const requests = [];
  const preview = `/museum/previews/${"a".repeat(64)}.webp`;
  const htmlByPath = new Map([
    [
      "/",
      html({
        links: ["/works/", "/studio/", "/contact/", "/exhibitions/erzia/"],
        resources: ["/favicon.png", "/site/home-hero.webp"]
      })
    ],
    [
      "/works/",
      html({
        links: ["/", "/works/sample-work/"],
        resources: ["/favicon.png", "/site/works-hero.webp", preview]
      })
    ],
    [
      "/contact/",
      html({
        links: ["/", "/exhibitions/erzia/"],
        resources: ["/favicon.png", "/site/contact-hero.webp"]
      })
    ]
  ]);

  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://fixture.test").pathname;
    requests.push(`${request.method} ${pathname}`);
    if (pathname === "/health.json") {
      const body = JSON.stringify({ status: "ok", commit });
      response.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
      response.end(body);
      return;
    }
    if (htmlByPath.has(pathname)) {
      const body = htmlByPath.get(pathname);
      response.writeHead(200, { "content-type": "text/html", "content-length": Buffer.byteLength(body) });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    response.writeHead(200, { "content-type": "application/octet-stream", "content-length": "1" });
    response.end(request.method === "HEAD" ? undefined : "x");
  });
  openServers.add(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, requests };
}

function html({ links, resources }) {
  return `<!doctype html><html><head><link rel="icon" href="${resources[0]}"></head><body>${links
    .map((href) => `<a href="${href}">link</a>`)
    .join("")}${resources.slice(1).map((src) => `<img src="${src}" alt="">`).join("")}</body></html>`;
}
