import { execFileSync } from "node:child_process";
import type { APIRoute } from "astro";
import { getCatalogManifest, getSiteContent } from "../domain/catalog/repository";

export const prerender = true;

const getCommit = () => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unknown";
  }
};

export const GET: APIRoute = () => {
  const manifest = getCatalogManifest();
  const siteContent = getSiteContent();
  const health = {
    status: "ok",
    generatedAt: manifest.generatedAt,
    commit: getCommit(),
    catalog: {
      records: manifest.counts.works,
      artworks: manifest.counts.artworkWorks,
      observations: manifest.counts.photographicWorks,
      assets: manifest.counts.assets,
      placements: manifest.counts.placements,
      snapshotId: manifest.sourceSnapshotId,
      generatedAt: manifest.generatedAt,
      portraitAssetId: siteContent.portraitAssetId
    }
  };

  return new Response(`${JSON.stringify(health, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};
