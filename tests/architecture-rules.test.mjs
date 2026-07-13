import { describe, expect, it } from "vitest";
import { analyzeArchitectureFile } from "../scripts/architecture-rules.mjs";

describe("architecture rules", () => {
  it("rejects oversized routes", () => {
    const source = Array.from({ length: 181 }, () => "<div />").join("\n");
    expect(analyzeArchitectureFile("src/pages/example.astro", source)).toContainEqual(
      expect.objectContaining({ rule: "route_size" })
    );
  });

  it("keeps browser controllers root-scoped and independent from server data", () => {
    const source = [
      'import { museumWorks } from "@lib/museum";',
      'document.querySelector("button");'
    ].join("\n");
    const rules = analyzeArchitectureFile("src/features/example/example-controller.ts", source)
      .map(({ rule }) => rule);
    expect(rules).toEqual(["client_import_boundary", "controller_global_query"]);
  });

  it("rejects raw catalog imports from route modules", () => {
    expect(analyzeArchitectureFile(
      "src/pages/example.astro",
      'import data from "../../src/generated/site-runtime.json";'
    )).toContainEqual(expect.objectContaining({ rule: "page_raw_data_import" }));
  });

  it("rejects repeated derived catalog counts in runtime checks", () => {
    expect(analyzeArchitectureFile(
      "scripts/verify-built-site.mjs",
      "const expectedWorks = 183;"
    )).toContainEqual(expect.objectContaining({ rule: "derived_count_literal" }));
  });
});
