import {
  WORDPRESS_BASE_URL,
  decodeText,
  fetchJson,
  fetchText,
  parseEnviraImages,
  parseVcIncludeIds,
  phoneHref,
  readJson,
  textFromHtml
} from "./wordpress-content.mjs";

const PAGE_IDS = {
  photoWorks: 7293,
  contact: 4547
};

const content = await readJson("src/data/site-content.json");
const errors = [];

const [portfolios, homeHtml, photoWorksPage, contactPage] = await Promise.all([
  fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/dt_portfolios?per_page=100&_fields=id,slug,title,link`),
  fetchText(`${WORDPRESS_BASE_URL}/`),
  fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/pages/${PAGE_IDS.photoWorks}?_fields=id,content,link`),
  fetchJson(`${WORDPRESS_BASE_URL}/wp-json/wp/v2/pages/${PAGE_IDS.contact}?_fields=id,content,link`)
]);

comparePortfolios(portfolios);
compareHomeGallery(homeHtml);
await comparePhotoWorks(photoWorksPage.content?.rendered || "");
compareContact(contactPage.content?.rendered || "", homeHtml);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `[audit-source] ok: ${content.artworks.length} portfolios, ${content.homeGallery.images.length} home media, ${content.photoWorks.images.length} photoworks, contacts`
);

function comparePortfolios(livePortfolios) {
  const live = livePortfolios.map((item) => ({
    wpId: item.id,
    slug: item.slug,
    title: decodeText(item.title?.rendered),
    sourcePageUrl: item.link
  }));
  const manifest = content.artworks.map((item) => ({
    wpId: item.wpId,
    slug: item.slug,
    title: item.title,
    sourcePageUrl: item.sourcePageUrl
  }));

  compareJson("portfolios", live, manifest);
}

function compareHomeGallery(homeHtml) {
  const liveUrls = parseEnviraImages(homeHtml).map((image) => image.sourceUrl);
  const manifestUrls = content.homeGallery.images.map((image) => image.sourceUrl);
  compareSet("home gallery image URLs", liveUrls, manifestUrls);
}

async function comparePhotoWorks(photoWorksHtml) {
  const ids = parseVcIncludeIds(photoWorksHtml).filter((id) => id >= 15000);
  const liveMedia = await fetchMediaByIds(ids);
  const liveUrls = liveMedia.map((item) => item.source_url);
  const manifestUrls = content.photoWorks.images.map((image) => image.sourceUrl);
  compareSet("photowork image URLs", liveUrls, manifestUrls);
}

function compareContact(contactHtml, fallbackHtml) {
  const html = contactHtml || fallbackHtml;
  const text = textFromHtml(html);
  const phone = text.match(/8\s*\(?927\)?\s*177[-\s]*68[-\s]*78/)?.[0]?.replace(/\s+/g, " ").trim();
  const email = decodeText(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "");
  const socialUrls = ["https://vk.com/id9435682", "https://t.me/nikitapichygin"];

  if (phoneHref(phone || "") !== content.contact.phoneHref) {
    errors.push(`contact phone mismatch: live ${phoneHref(phone || "")}, manifest ${content.contact.phoneHref}`);
  }
  if (`mailto:${email}` !== content.contact.emailHref) {
    errors.push(`contact email mismatch: live mailto:${email}, manifest ${content.contact.emailHref}`);
  }
  for (const href of socialUrls) {
    if (!content.contact.social.some((item) => item.href === href)) {
      errors.push(`contact social missing from manifest: ${href}`);
    }
  }
}

async function fetchMediaByIds(ids) {
  const results = [];
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    if (chunk.length === 0) {
      continue;
    }
    const response = await fetchJson(
      `${WORDPRESS_BASE_URL}/wp-json/wp/v2/media?per_page=100&include=${chunk.join(",")}&_fields=id,source_url`
    );
    const byId = new Map(response.map((item) => [item.id, item]));
    results.push(...chunk.map((id) => byId.get(id)).filter(Boolean));
  }
  return results;
}

function compareJson(label, live, manifest) {
  if (JSON.stringify(live) !== JSON.stringify(manifest)) {
    errors.push(`${label} mismatch between live WordPress and manifest`);
  }
}

function compareSet(label, liveValues, manifestValues) {
  const live = new Set(liveValues);
  const manifest = new Set(manifestValues);
  for (const value of live) {
    if (!manifest.has(value)) {
      errors.push(`${label}: manifest missing ${value}`);
    }
  }
  for (const value of manifest) {
    if (!live.has(value)) {
      errors.push(`${label}: source missing ${value}`);
    }
  }
  if (live.size !== manifest.size) {
    errors.push(`${label}: live has ${live.size}, manifest has ${manifest.size}`);
  }
}
