import { describe, expect, it } from "vitest";
import { formatRenderBlueprint, validateRedirects } from "../scripts/render-blueprint.mjs";

describe("Render blueprint generation", () => {
  it("renders a deterministic static service", () => {
    const output = formatRenderBlueprint([{ source: "/old/", destination: "/works/example/" }]);
    expect(output).toContain("buildCommand: npm run build:deploy");
    expect(output).toContain("source: /old/\n        destination: /works/example/");
    expect(output.endsWith("\n")).toBe(true);
  });

  it("rejects duplicate or unsafe redirects", () => {
    expect(() => validateRedirects([
      { source: "/old/", destination: "/new/" },
      { source: "/old/", destination: "/other/" }
    ])).toThrow("Duplicate");
    expect(() => validateRedirects([{ source: "old", destination: "/new/" }])).toThrow("Invalid");
  });
});
