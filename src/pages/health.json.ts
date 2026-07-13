import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";

export const prerender = true;

const projectRoot = process.cwd();

const readJson = (relativePath: string) => JSON.parse(
  readFileSync(path.join(projectRoot, relativePath), "utf8")
);

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
  const manifest = readJson("content-export/data/manifest.json");
  const siteContent = readJson("content-export/data/site-content.json");
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
      snapshotId: manifest.snapshotId,
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
