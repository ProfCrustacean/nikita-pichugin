import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  SmokeError,
  changedPathsFromFiles,
  commitsMatch,
  parseCliArgs,
  runProductionSmoke,
  validatePageReferences,
  validateTourMarkup
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
      "/archive/",
      "/contact/",
      "/studio/",
      "/works/"
    ]);
  });

  it("routes features, site config, and generated catalog changes to their affected pages", () => {
    expect(changedPathsFromFiles(["src/features/studio/StudioPage.astro"])).toEqual(["/studio/"]);
    expect(changedPathsFromFiles(["src/features/tour/TourView.astro"])).toEqual(["/"]);
    expect(changedPathsFromFiles(["public/tours/erzia-pichugin/museum-01.xml"])).toEqual([
      "/",
      "/tours/erzia-pichugin/museum-01.xml"
    ]);
    expect(changedPathsFromFiles(["src/config/site-config.json"])).toEqual([
      "/",
      "/archive/",
      "/contact/",
      "/studio/",
      "/works/"
    ]);

    const catalogPaths = changedPathsFromFiles(["src/generated/site-runtime.json"]);
    expect(catalogPaths).toContain("/");
    expect(catalogPaths).toContain("/archive/");
    expect(catalogPaths).toContain("/studio/");
    expect(catalogPaths).toContain("/works/");
    expect(catalogPaths).toContain("/works/9-maya-af03f7d7/");
    expect(catalogPaths).toContain("/works/fotokompozitsiya-003d31ab/");
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
        resources: ["/favicon.png"]
      })
    ).toThrow(SmokeError);
  });

  it("requires the homepage tour to stay deferred and locally linked", () => {
    expect(() => validateTourMarkup("/", homeHtml())).not.toThrow();
    expect(() => validateTourMarkup("/", homeHtml({ eager: true }))).toThrowError(
      expect.objectContaining({ code: "INVALID_HOME_TOUR_FRAME" })
    );
    expect(() => validateTourMarkup("/", homeHtml({ tourHref: "/exhibitions/erzia/" }))).toThrowError(
      expect.objectContaining({ code: "STALE_EXHIBITION_LINK" })
    );
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
    expect(result.checks.pages).toBe(4);
    expect(result.checks.notFound).toBe(3);
    expect(fixture.requests).toContain("GET /health.json");
    expect(fixture.requests).toContain("GET /contact/");
    expect(fixture.requests).toContain("GET /tours/erzia-pichugin/index.html");
    expect(fixture.requests).toContain("HEAD /tours/erzia-pichugin/museum-01.xml");
    expect(fixture.requests).toContain("HEAD /site/contact-hero.webp");
    expect(fixture.requests).toContain("HEAD /works/sample-work/");
    expect(fixture.requests).toContain("GET /exhibitions/");
    expect(fixture.requests).toContain("GET /exhibitions/erzia/");
    expect(fixture.requests).toContain("GET /exhibitions/future-test/");
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
    ["/", homeHtml()],
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
        links: ["/"],
        resources: ["/favicon.png", "/site/contact-hero.webp"],
        body: '<a data-exhibition-entry="contact" href="/#erzia-tour">tour</a>'
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
    if (["/exhibitions/", "/exhibitions/erzia/", "/exhibitions/future-test/"].includes(pathname)) {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("missing");
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

function homeHtml({ eager = false, tourHref = "/#erzia-tour" } = {}) {
  return `<!doctype html><html><head><link rel="icon" href="/favicon.png"></head><body>
    <nav aria-label="Основная навигация"><a href="/works/">works</a><a href="/studio/">studio</a><a href="/contact/">contact</a><a href="${tourHref}">Выставка</a></nav>
    <nav aria-label="Нижняя навигация"><a href="${tourHref}">Выставка</a></nav>
    <img src="/site/home-hero.webp" alt=""><img src="/site/exhibition-hall.webp" alt="">
    <section id="erzia-tour" data-tour-shell>
      <iframe data-tour-frame data-tour-src="/tours/erzia-pichugin/index.html"${eager ? ' src="/tours/erzia-pichugin/index.html"' : ""}></iframe>
      <button data-tour-enter>enter</button><button data-tour-exit>exit</button>
    </section>
  </body></html>`;
}

function html({ links, resources, body = "" }) {
  return `<!doctype html><html><head><link rel="icon" href="${resources[0]}"></head><body>${links
    .map((href) => `<a href="${href}">link</a>`)
    .join("")}${resources.slice(1).map((src) => `<img src="${src}" alt="">`).join("")}${body}</body></html>`;
}
