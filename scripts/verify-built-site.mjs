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
const works = await readJsonLines(path.join(projectRoot, "content-export", "data", "works.jsonl"));
const assets = await readJsonLines(path.join(projectRoot, "content-export", "data", "assets.jsonl"));
const sourceContent = JSON.parse(await readFile(path.join(projectRoot, "src", "data", "site-content.json"), "utf8"));
const renderBlueprint = await readFile(path.join(projectRoot, "render.yaml"), "utf8");
const detailFiles = works.map((work) => path.join(distRoot, "works", work.publicSlug, "index.html"));
for (const file of detailFiles) assert(files.includes(file), `missing detail route ${path.relative(distRoot, file)}`);
assert(detailFiles.length === 270, `expected 270 detail routes, found ${detailFiles.length}`);

const worksHtml = await readFile(path.join(distRoot, "works", "index.html"), "utf8");
const studioHtml = await readFile(path.join(distRoot, "studio", "index.html"), "utf8");
const homeHtml = await readFile(path.join(distRoot, "index.html"), "utf8");
assert((worksHtml.match(/<article[^>]*data-catalog-item[^>]*>/g) ?? []).length === 183, "works page must expose 183 artwork records");
assert((studioHtml.match(/observation-wall__item/g) ?? []).length === 87, "studio page must expose 87 observations");
assert(studioHtml.includes("Выставка в Музее Эрьзи"), "Erzia Museum exhibition tour is mislabeled");
assert(!homeHtml.includes("noindex"), "homepage must be indexable");
assert(!homeHtml.includes("prototype-switcher"), "prototype switcher leaked into homepage");
assert(!files.some((file) => file.includes(`${path.sep}portfolios${path.sep}`) && file.endsWith(".html")), "portfolio redirect HTML leaked into production");
for (const rendition of ["home-hero.webp", "works-hero.webp", "contact-hero.webp"]) {
  assert(files.includes(path.join(distRoot, "site", rendition)), `missing high-resolution rendition ${rendition}`);
}

const expectedRedirects = [
  ["/portfolio/galereya-rabot-hudozhnika-nikity-pichugina/", "/works/"],
  ["/masterskaya-nikity-pichugina/", "/studio/"],
  ["/contact-info/", "/contact/"],
  ...sourceContent.artworks.map((sourceWork) => {
    const work = works.find((candidate) => candidate.recordSource.some((source) => source.wpPortfolioId === sourceWork.wpId));
    return [`/portfolios/${sourceWork.slug}/`, work ? `/works/${work.publicSlug}/` : "/works/"];
  })
];
for (const [source, destination] of expectedRedirects) {
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
assert((sitemap.match(/<url>/g) ?? []).length === 275, "sitemap must contain 5 main routes and 270 detail routes");
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
  `[verify:site] ok: ${detailFiles.length} details, 183 artworks, 87 observations, ` +
  `${previewReferences.size} presented assets with complete work relations`
);

async function readJsonLines(filePath) {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
