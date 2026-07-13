import { generateSiteRuntime, SITE_RUNTIME_PATH } from "./site-runtime.mjs";

const check = process.argv.includes("--check");

try {
  const { runtime } = await generateSiteRuntime({ check });
  console.log(JSON.stringify({
    event: check ? "site_runtime_verified" : "site_runtime_generated",
    path: SITE_RUNTIME_PATH,
    snapshotId: runtime.sourceSnapshotId,
    sourceDigest: runtime.sourceDigest,
    works: runtime.counts.works,
    assets: runtime.counts.assets,
    redirects: runtime.legacyRedirects.length
  }));
} catch (error) {
  console.error(JSON.stringify({
    event: "site_runtime_error",
    message: error instanceof Error ? error.message : String(error)
  }));
  process.exitCode = 1;
}
