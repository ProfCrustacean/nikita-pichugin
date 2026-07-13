import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(projectRoot, "dist");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
  }));
  return nested.flat();
}

function assert(condition, message) {
  if (!condition) throw new Error(`[verify:site] ${message}`);
}

const files = await listFiles(distRoot);
assert(!files.some((file) => file.startsWith(path.join(distRoot, "content"))), "unused public/content leaked into production");
assert(!files.some((file) => file.startsWith(path.join(distRoot, "fonts"))), "unused fonts leaked into production");
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const canonicalHtmlFiles = htmlFiles;
const runtime = JSON.parse(await readFile(path.join(projectRoot, "src", "generated", "site-runtime.json"), "utf8"));
const siteConfig = JSON.parse(await readFile(path.join(projectRoot, "src", "config", "site-config.json"), "utf8"));
const tourInventory = JSON.parse(await readFile(path.join(projectRoot, "scripts", "erzia-tour.inventory.json"), "utf8"));
const { works, assets, counts, legacyRedirects, routeRegistry } = runtime;
const renderBlueprint = await readFile(path.join(projectRoot, "render.yaml"), "utf8");
assert(renderBlueprint.includes("buildCommand: npm run build:deploy"), "Render must use the deploy-only build command");
const detailFiles = works.map((work) => path.join(distRoot, "works", work.publicSlug, "index.html"));
for (const file of detailFiles) assert(files.includes(file), `missing detail route ${path.relative(distRoot, file)}`);
assert(detailFiles.length === counts.works, `expected ${counts.works} detail routes, found ${detailFiles.length}`);

const worksHtml = await readFile(path.join(distRoot, "works", "index.html"), "utf8");
const studioHtml = await readFile(path.join(distRoot, "studio", "index.html"), "utf8");
const contactHtml = await readFile(path.join(distRoot, "contact", "index.html"), "utf8");
const homeHtml = await readFile(path.join(distRoot, "index.html"), "utf8");
const exhibitionHtml = await readFile(path.join(distRoot, "exhibitions", "erzia", "index.html"), "utf8");
const health = JSON.parse(await readFile(path.join(distRoot, "health.json"), "utf8"));
assert(health.status === "ok", "health endpoint must report ok");
assert(/^(?:[a-f0-9]{7,40}|unknown)$/.test(health.commit), "health endpoint has an invalid commit");
assert(health.catalog?.records === works.length, "health endpoint has a stale work count");
assert(health.catalog?.assets === assets.length, "health endpoint has a stale asset count");
assert(
  (worksHtml.match(/<article[^>]*data-catalog-item[^>]*>/g) ?? []).length === counts.artworkWorks,
  `works page must expose ${counts.artworkWorks} artwork records`
);
assert(
  load(studioHtml)("a.observation-wall__item").length === counts.photographicWorks,
  `studio page must expose ${counts.photographicWorks} observations`
);
assert(studioHtml.includes("Выставка в Музее Эрьзи"), "Erzia Museum exhibition tour is mislabeled");
assert(
  load(studioHtml)(".studio-tour a[href='/exhibitions/erzia/']").length === 1,
  "studio page must link to the locally hosted Erzia exhibition"
);
const homeDocument = load(homeHtml);
for (const navigationLabel of ["Основная навигация", "Нижняя навигация"]) {
  const exhibitionLinks = homeDocument(`nav[aria-label='${navigationLabel}'] a[href='/exhibitions/erzia/']`)
    .filter((_, element) => homeDocument(element).text().trim() === "Выставка");
  assert(exhibitionLinks.length === 1, `${navigationLabel} must expose one local exhibition link`);
}
for (const [entry, html] of [["home", homeHtml], ["contact", contactHtml]]) {
  const document = load(html);
  const links = document(`a[data-exhibition-entry='${entry}']`);
  assert(links.length === 1, `${entry} page must expose one contextual exhibition entry`);
  assert(links.attr("href") === "/exhibitions/erzia/", `${entry} exhibition entry must stay local`);
  assert(!links.attr("target"), `${entry} exhibition entry must open in the same tab`);
}
assert(
  load(exhibitionHtml)("iframe[src='/tours/erzia-pichugin/index.html']").length === 1,
  "Erzia exhibition page must embed the local tour"
);
assert(!homeHtml.includes("noindex"), "homepage must be indexable");
assert(!homeHtml.includes("prototype-switcher"), "prototype switcher leaked into homepage");
assert(!files.some((file) => file.includes(`${path.sep}portfolios${path.sep}`) && file.endsWith(".html")), "portfolio redirect HTML leaked into production");
for (const rendition of ["home-hero.webp", "works-hero.webp", "contact-hero.webp", "exhibition-hall.webp"]) {
  assert(files.includes(path.join(distRoot, "site", rendition)), `missing high-resolution rendition ${rendition}`);
}

const tourRoot = path.join(distRoot, "tours", "erzia-pichugin");
const tourFiles = files.filter((file) => file.startsWith(`${tourRoot}${path.sep}`));
assert(
  tourFiles.length === tourInventory.expectedFileCount,
  `expected the complete ${tourInventory.expectedFileCount}-file Erzia tour, found ${tourFiles.length}`
);

const cacheManifestPath = path.join(tourRoot, "05.manifest");
const cacheManifest = await readFile(cacheManifestPath, "utf8");
assert(cacheManifest.trimStart().startsWith("CACHE MANIFEST"), "Erzia tour cache manifest has an invalid header");
const cacheEntries = cacheManifest
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && line !== "CACHE MANIFEST" && !line.startsWith("#"));
const expectedCacheEntries = tourInventory.expectedFileCount - 2;
assert(
  cacheEntries.length === expectedCacheEntries,
  `Erzia tour manifest must list ${expectedCacheEntries} runtime files, found ${cacheEntries.length}`
);
assert(cacheEntries.every((entry) => !/^https?:\/\//i.test(entry)), "Erzia tour manifest must be fully local");
assert(cacheEntries.every((entry) => !entry.startsWith("/") && !entry.split("/").includes("..")), "Erzia tour manifest contains an unsafe path");
assert(new Set(cacheEntries).size === cacheEntries.length, "Erzia tour manifest contains duplicate entries");

const expectedTourFiles = new Set(["index.html", "05.manifest", ...cacheEntries]);
const actualTourFiles = new Set(tourFiles.map((file) => path.relative(tourRoot, file).split(path.sep).join("/")));
assert(
  expectedTourFiles.size === actualTourFiles.size && [...expectedTourFiles].every((file) => actualTourFiles.has(file)),
  "Erzia tour package and its manifest differ"
);

for (const relativeFile of expectedTourFiles) {
  const fileStat = await stat(path.join(tourRoot, relativeFile)).catch(() => null);
  assert(fileStat?.size > 0, `missing or empty Erzia tour file ${relativeFile}`);
}

for (const relativeFile of [
  "index.html",
  "museum-01.xml",
  "pano2vr_player.js",
  "skin.js",
  "images/05_o_0.jpg",
  "images/01_o_preview_0.jpg"
]) {
  assert(actualTourFiles.has(relativeFile), `missing representative Erzia tour asset ${relativeFile}`);
}

const tourXml = await readFile(path.join(tourRoot, "museum-01.xml"), "utf8");
const startNode = tourXml.match(/<tour\b[^>]*\bstart="([^"]+)"/)?.[1];
const panoramaIds = [...tourXml.matchAll(/<panorama\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);
const hotspotTargets = [...tourXml.matchAll(/<hotspot\b[^>]*\burl="\{([^}]+)\}"/g)].map((match) => match[1]);
const panoramaMedia = [...tourXml.matchAll(/\b(?:tile\durl|prev\durl)="([^"]+)"/g)].map((match) => match[1]);
assert(panoramaIds.length === 5, `Erzia tour must contain 5 panoramas, found ${panoramaIds.length}`);
assert(new Set(panoramaIds).size === panoramaIds.length, "Erzia tour panorama IDs must be unique");
assert(startNode && panoramaIds.includes(startNode), "Erzia tour start panorama is missing");
assert(hotspotTargets.length === 8, `Erzia tour must contain 8 navigation hotspots, found ${hotspotTargets.length}`);
assert(hotspotTargets.every((target) => panoramaIds.includes(target)), "Erzia tour has a hotspot with a missing destination");
assert(panoramaMedia.length === 60, `Erzia tour must reference 60 panorama images, found ${panoramaMedia.length}`);
assert(panoramaMedia.every((file) => actualTourFiles.has(file)), "Erzia tour configuration references a missing panorama image");

const forbiddenTourHosts = /(?:erzia-museum\.ru|k360\.ru)/i;
for (const file of tourFiles.filter((file) => /\.(?:html|xml|js|css|manifest)$/i.test(file))) {
  const source = await readFile(file, "utf8");
  assert(!forbiddenTourHosts.test(source), `remote museum or K360 URL leaked into ${path.relative(distRoot, file)}`);
}
assert(!forbiddenTourHosts.test(studioHtml), "remote museum or K360 URL leaked into studio page");
assert(!forbiddenTourHosts.test(exhibitionHtml), "remote museum or K360 URL leaked into exhibition page");

for (const { source, destination } of legacyRedirects) {
  assert(
    renderBlueprint.includes(`source: ${source}\n        destination: ${destination}`),
    `Render redirect is missing or wrong: ${source} -> ${destination}`
  );
}

for (const [label, html] of [["homepage", homeHtml], ["works", worksHtml], ["studio", studioHtml]]) {
  assert((html.match(/src="\/favicon\.png"/g) ?? []).length >= 2, `${label} must use favicon in header and footer`);
}

const forbiddenCopy = [
  "Метаданные зафиксированы по подписи",
  "Живописная работа Никиты Пичугина",
  "Фотографическая работа Никиты Пичугина",
];
const technicalTitle = /\b(?:photo_|IMG_|DSC\d)/i;
const fabricatedNumber = /NP-[0-9]{4}/i;
const internalWorkId = /work_[a-f0-9]{16}/i;
const obsoleteCatalogField = ["catalog", "Number"].join("");
const previewReferences = new Set();

for (const file of canonicalHtmlFiles) {
  const html = await readFile(file, "utf8");
  assert(!forbiddenTourHosts.test(html), `remote museum or K360 URL leaked into ${path.relative(distRoot, file)}`);
  const $ = load(html);
  $("script, style, noscript").remove();
  const publicCopy = `${$("body").text()} ${$("[alt]").map((_, element) => $(element).attr("alt") ?? "").get().join(" ")}`;
  for (const phrase of forbiddenCopy) {
    assert(!publicCopy.includes(phrase), `template copy leaked into ${path.relative(distRoot, file)}: ${phrase}`);
  }
  assert(!technicalTitle.test(publicCopy), `technical filename leaked into visible copy in ${path.relative(distRoot, file)}`);
  assert(!fabricatedNumber.test(html), `fabricated NP classification leaked into ${path.relative(distRoot, file)}`);
  assert(!internalWorkId.test(html), `internal work ID leaked into ${path.relative(distRoot, file)}`);
  assert(!html.includes(obsoleteCatalogField), `obsolete catalog identifier field leaked into ${path.relative(distRoot, file)}`);
  for (const match of html.matchAll(/\/museum\/previews\/([a-f0-9]{64}\.webp)/g)) {
    previewReferences.add(match[1]);
  }
}

assert(previewReferences.size === assets.length, `expected all ${assets.length} museum previews to be presented, found ${previewReferences.size}`);
for (const filename of previewReferences) {
  const previewPath = path.join(distRoot, "museum", "previews", filename);
  const previewStat = await stat(previewPath).catch(() => null);
  assert(previewStat?.size > 0, `missing or empty preview ${filename}`);
}

const sitemap = await readFile(path.join(distRoot, "sitemap.xml"), "utf8");
const registeredSitemapPaths = [...siteConfig.staticRoutes, ...routeRegistry.workPaths];
assert(
  (sitemap.match(/<url>/g) ?? []).length === registeredSitemapPaths.length,
  `sitemap must contain ${registeredSitemapPaths.length} registered routes`
);
assert(sitemap.includes("/exhibitions/erzia/"), "Erzia exhibition route is missing from sitemap");
assert(!fabricatedNumber.test(sitemap) && !/\/works\/np-/i.test(sitemap), "fabricated NP routes leaked into sitemap");

for (const work of works) {
  const file = path.join(distRoot, "works", work.publicSlug, "index.html");
  const html = await readFile(file, "utf8");
  const $ = load(html);
  const renderedAssetIds = $("[data-work-asset-id]").map((_, element) => $(element).attr("data-work-asset-id")).get().sort();
  const expectedAssetIds = [...new Set(work.assetIds)].sort();
  assert(JSON.stringify(renderedAssetIds) === JSON.stringify(expectedAssetIds), `${work.publicSlug}: own detail media do not match linked assets`);
  assert(new Set(renderedAssetIds).size === renderedAssetIds.length, `${work.publicSlug}: linked asset rendered more than once`);
  if (work.recordType === "photographic_work") {
    assert($("h1").first().text().trim() === "Фотокомпозиция", `${work.publicSlug}: photographic work has a non-neutral public title`);
    const metaDescription = $("meta[name='description']").attr("content") || "";
    assert(!/г\.\.|Дата уточняется/.test(metaDescription), `${work.publicSlug}: malformed photographic SEO description`);
  }
  assert($("script[type='application/ld+json']").length === 1, `${work.publicSlug}: missing JSON-LD artwork record`);
}

const notFoundHtml = await readFile(path.join(distRoot, "404.html"), "utf8");
const notFound = load(notFoundHtml);
assert(notFound("meta[name='robots']").attr("content") === "noindex,follow", "404 page must be noindex,follow");
assert(notFound("link[rel='canonical']").length === 0, "404 page must not publish a canonical URL");

for (const file of canonicalHtmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/href="(tel:[^"]+)"/g)) {
    assert(match[1] === "tel:+79271776878", `invalid phone link in ${path.relative(distRoot, file)}: ${match[1]}`);
  }
}

console.log(
  `[verify:site] ok: ${detailFiles.length} details, ${counts.artworkWorks} artworks, ` +
  `${counts.photographicWorks} observations, ` +
  `${previewReferences.size} presented assets, complete work relations, and a ${tourFiles.length}-file Erzia tour`
);
