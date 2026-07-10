import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const [manifest, siteContent] = await Promise.all([
  readFile("content-export/data/manifest.json", "utf8").then(JSON.parse),
  readFile("content-export/data/site-content.json", "utf8").then(JSON.parse)
]);

let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
} catch {
  commit = "uncommitted";
}

const health = {
  status: "ok",
  generatedAt: manifest.generatedAt,
  commit,
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

await mkdir("public", { recursive: true });
await writeFile("public/health.json", `${JSON.stringify(health, null, 2)}\n`);
console.log(
  `[health] wrote public/health.json (${health.catalog.artworks} artworks, ` +
  `${health.catalog.observations} observations, ${health.catalog.assets} assets)`
);
