import { rm } from "node:fs/promises";
import path from "node:path";

const distRoot = path.resolve(import.meta.dirname, "..", "dist");
const obsoletePublicPaths = ["content", "fonts"];

for (const relativePath of obsoletePublicPaths) {
  await rm(path.join(distRoot, relativePath), { recursive: true, force: true });
}

console.log(`[prune:dist] removed ${obsoletePublicPaths.join(", ")} from the published artifact`);
