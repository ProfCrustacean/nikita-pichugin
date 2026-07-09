import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { readJson } from "./wordpress-content.mjs";

const content = await readJson("src/data/site-content.json");

let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
  commit = "uncommitted";
}

const health = {
  status: "ok",
  generatedAt: new Date().toISOString(),
  commit,
  content: {
    artworks: content.artworks.length,
    homeGallery: content.homeGallery.images.length,
    photoWorks: content.photoWorks.images.length,
    importedAt: content.source.importedAt
  }
};

await mkdir("public", { recursive: true });
await writeFile("public/health.json", `${JSON.stringify(health, null, 2)}\n`);
console.log(
  `[health] wrote public/health.json (${health.content.artworks} artworks, ${health.content.homeGallery} home media)`
);
