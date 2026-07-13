import runtime from "../../src/generated/site-runtime.json" with { type: "json" };

export const catalogCounts = runtime.counts;
export const workOnPaperCount = runtime.works
  .filter((work) => work.recordType === "artwork" && work.objectWorkType === "work on paper")
  .length;
export const studioProcessImageCount = runtime.assets
  .filter((asset) => asset.visualClass === "studio_or_process_photo")
  .length;
