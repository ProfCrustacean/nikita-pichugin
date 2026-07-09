import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LIVE_INVENTORY = "content/audit/live-content-inventory.json";
const PROJECT_CONTENT = "src/data/site-content.json";
const OUTPUT_DIR = "content/audit";
const OUTPUT_JSON = path.join(OUTPUT_DIR, "live-vs-project-mismatches.json");
const OUTPUT_MD = path.join(OUTPUT_DIR, "live-vs-project-mismatches.md");

async function main() {
  const live = JSON.parse(await readFile(LIVE_INVENTORY, "utf8"));
  const project = JSON.parse(await readFile(PROJECT_CONTENT, "utf8"));

  const findings = [
    ...compareArtworks(live.artworks, project.artworks),
    ...compareImageCollection({
      section: "homeGallery",
      liveImages: live.homeGallery.images,
      projectImages: project.homeGallery.images
    }),
    ...compareImageCollection({
      section: "photoWorks",
      liveImages: live.photoWorks.images,
      projectImages: project.photoWorks.images
    }),
    ...compareSecondaryScope(live.summary)
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    sourceInventory: LIVE_INVENTORY,
    projectContent: PROJECT_CONTENT,
    summary: {
      totalFindings: findings.length,
      bySeverity: countBy(findings, (finding) => finding.severity),
      byCode: countBy(findings, (finding) => finding.code)
    },
    findings
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(OUTPUT_MD, renderMarkdown(report));
  console.log(`[compare-live-content] wrote ${OUTPUT_JSON}: ${findings.length} findings`);
}

function compareArtworks(liveArtworks, projectArtworks) {
  const findings = [];
  const liveBySlug = new Map(liveArtworks.map((artwork) => [artwork.slug, artwork]));
  const projectBySlug = new Map(projectArtworks.map((artwork) => [artwork.slug, artwork]));

  for (const slug of liveBySlug.keys()) {
    if (!projectBySlug.has(slug)) {
      findings.push({
        severity: "critical",
        code: "missing_artwork_in_project",
        section: "artworks",
        slug,
        detail: "Artwork exists in live WordPress dt_portfolios but is absent from project manifest."
      });
    }
  }

  for (const slug of projectBySlug.keys()) {
    if (!liveBySlug.has(slug)) {
      findings.push({
        severity: "high",
        code: "extra_artwork_in_project",
        section: "artworks",
        slug,
        detail: "Artwork exists in project manifest but is absent from live WordPress dt_portfolios."
      });
    }
  }

  for (const [slug, liveArtwork] of liveBySlug.entries()) {
    const projectArtwork = projectBySlug.get(slug);
    if (!projectArtwork) continue;

    for (const field of ["title", "year", "medium", "dimensions"]) {
      if (normalizeText(liveArtwork[field]) !== normalizeText(projectArtwork[field])) {
        findings.push({
          severity: "high",
          code: "artwork_metadata_mismatch",
          section: "artworks",
          slug,
          field,
          liveValue: liveArtwork[field] || "",
          projectValue: projectArtwork[field] || "",
          detail: `${slug}: ${field} differs from live WordPress source.`
        });
      }
    }

    const liveCanonical = liveArtwork.images.map((image) => canonicalUploadUrl(image.sourceUrl));
    const projectCanonical = projectArtwork.images.map((image) => canonicalUploadUrl(image.sourceUrl));
    const liveSet = new Set(liveCanonical);
    const projectSet = new Set(projectCanonical);
    const missingCanonical = [...liveSet].filter((url) => !projectSet.has(url));
    const extraCanonical = [...projectSet].filter((url) => !liveSet.has(url));
    const duplicateGroups = duplicateGroupsByCanonical(projectArtwork.images);
    const importedHtmlExtras = (liveArtwork.htmlExtraImageReferences || [])
      .map((image) => canonicalUploadUrl(image.sourceUrl))
      .filter((url) => projectSet.has(url));

    if (projectArtwork.images.length !== liveArtwork.images.length) {
      findings.push({
        severity: "high",
        code: "artwork_image_count_mismatch",
        section: "artworks",
        slug,
        liveTrustedImageCount: liveArtwork.images.length,
        projectImageCount: projectArtwork.images.length,
        projectCanonicalUniqueCount: projectSet.size,
        duplicateCanonicalGroups: duplicateGroups,
        detail: `${slug}: project has ${projectArtwork.images.length} image records; live trusted sitemap/schema has ${liveArtwork.images.length}.`
      });
    }

    if (missingCanonical.length > 0) {
      findings.push({
        severity: "critical",
        code: "artwork_missing_trusted_images",
        section: "artworks",
        slug,
        missingCanonical,
        detail: `${slug}: project is missing trusted live artwork images.`
      });
    }

    if (extraCanonical.length > 0) {
      findings.push({
        severity: "high",
        code: "artwork_extra_untrusted_images",
        section: "artworks",
        slug,
        extraCanonical,
        detail: `${slug}: project contains canonical images that are not trusted sitemap/schema artwork images.`
      });
    }

    if (duplicateGroups.length > 0) {
      findings.push({
        severity: "high",
        code: "artwork_duplicate_size_variants_imported",
        section: "artworks",
        slug,
        duplicateCanonicalGroups: duplicateGroups,
        detail: `${slug}: project imported WordPress size variants as separate artwork images.`
      });
    }

    if (importedHtmlExtras.length > 0) {
      findings.push({
        severity: "high",
        code: "artwork_raw_html_extra_refs_imported",
        section: "artworks",
        slug,
        importedHtmlExtras,
        detail: `${slug}: project imported raw HTML upload references not present in trusted sitemap/schema images.`
      });
    }
  }

  return findings;
}

function compareImageCollection({ section, liveImages, projectImages }) {
  const findings = [];
  const liveCanonical = liveImages.map((image) => canonicalUploadUrl(image.sourceUrl));
  const projectCanonical = projectImages.map((image) => canonicalUploadUrl(image.sourceUrl));
  const liveSet = new Set(liveCanonical);
  const projectSet = new Set(projectCanonical);
  const missingCanonical = [...liveSet].filter((url) => !projectSet.has(url));
  const extraCanonical = [...projectSet].filter((url) => !liveSet.has(url));
  const firstOrderMismatchIndex = liveCanonical.findIndex((url, index) => projectCanonical[index] !== url);

  if (liveImages.length !== projectImages.length || missingCanonical.length > 0 || extraCanonical.length > 0) {
    findings.push({
      severity: "high",
      code: "section_image_set_mismatch",
      section,
      liveCount: liveImages.length,
      projectCount: projectImages.length,
      missingCanonical,
      extraCanonical,
      detail: `${section}: project image set differs from live source.`
    });
  }

  if (firstOrderMismatchIndex >= 0) {
    findings.push({
      severity: "medium",
      code: "section_image_order_mismatch",
      section,
      firstOrderMismatchIndex,
      liveUrl: liveCanonical[firstOrderMismatchIndex],
      projectUrl: projectCanonical[firstOrderMismatchIndex],
      detail: `${section}: image order differs at 1-based position ${firstOrderMismatchIndex + 1}.`
    });
  }

  return findings;
}

function compareSecondaryScope(summary) {
  const findings = [];
  if (summary.sourceCounts.publicPagesFetched > 4 || summary.sourceCounts.publicProductsFetched > 0) {
    findings.push({
      severity: "medium",
      code: "live_wp_has_public_secondary_demo_shop_content",
      section: "scope",
      livePublicPages: summary.sourceCounts.publicPagesFetched,
      livePublicProducts: summary.sourceCounts.publicProductsFetched,
      demoImageOccurrences: summary.secondaryContentCounts.demoOrSecondaryPageImageOccurrences,
      detail:
        "Live WordPress exposes public demo/shop/test pages. They should stay explicitly out-of-scope or be intentionally handled; do not mix them into artist sections."
    });
  }
  return findings;
}

function duplicateGroupsByCanonical(images) {
  const groups = new Map();
  for (const image of images) {
    const canonical = canonicalUploadUrl(image.sourceUrl);
    if (!groups.has(canonical)) groups.set(canonical, []);
    groups.get(canonical).push(image.sourceUrl);
  }
  return Array.from(groups.entries())
    .filter(([, urls]) => urls.length > 1)
    .map(([canonicalUrl, sourceUrls]) => ({ canonicalUrl, sourceUrls }));
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Live WordPress vs Project Content Mismatches");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Source inventory: \`${report.sourceInventory}\``);
  lines.push(`Project content: \`${report.projectContent}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`Total findings: ${report.summary.totalFindings}`);
  lines.push("");
  lines.push("| Severity | Code | Count |");
  lines.push("| --- | --- | ---: |");
  for (const [code, count] of Object.entries(report.summary.byCode)) {
    const severity = report.findings.find((finding) => finding.code === code)?.severity || "";
    lines.push(`| ${severity} | ${escapeMd(code)} | ${count} |`);
  }
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push("| Severity | Code | Section | Slug | Detail |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const finding of report.findings) {
    lines.push(
      `| ${finding.severity} | ${escapeMd(finding.code)} | ${escapeMd(finding.section)} | ${escapeMd(finding.slug || "")} | ${escapeMd(finding.detail)} |`
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function countBy(items, getKey) {
  return items.reduce((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function canonicalUploadUrl(url = "") {
  return String(url)
    .replaceAll("\\/", "/")
    .replace(/^http:\/\//, "https://")
    .replace(/\?.*$/, "")
    .replace(/-\d{2,5}x\d{2,5}(?=\.(?:jpe?g|png|gif|webp)$)/i, "");
}

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeMd(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
