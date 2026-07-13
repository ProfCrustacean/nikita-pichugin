import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyChangedPath,
  classifyChangeSet,
  getWorkingTreeChanges,
  normalizeChangedPath
} from "../scripts/change-scope.mjs";

describe("change-scope classification", () => {
  it("normalizes repository-relative paths", () => {
    expect(normalizeChangedPath(".\\src\\pages\\index.astro")).toBe("src/pages/index.astro");
  });

  it.each([
    "src/pages/index.astro",
    "src/components/SundayHeader.astro",
    "src/styles/sunday.css",
    "src/features/home/HomeHero.astro",
    "src/config/site-config.json",
    "src/lib/format.ts"
  ])("classifies %s as standard", (path) => {
    expect(classifyChangedPath(path).scope).toBe("standard");
  });

  it.each(["tests/content-parsers.test.mjs", "docs/deploy.md", "README.md", "AGENTS.md"])(
    "classifies %s as fast",
    (path) => {
      expect(classifyChangedPath(path).scope).toBe("fast");
    }
  );

  it.each([
    "content-export/data/works.jsonl",
    "content/museum/editorial-overrides.json",
    "public/tours/erzia-pichugin/index.html",
    "src/domain/catalog/repository.ts",
    "src/generated/site-runtime.json",
    "src/lib/museum.ts",
    "scripts/health.mjs",
    "package-lock.json",
    "astro.config.mjs",
    "playwright.config.ts",
    "public/health.json",
    "render.yaml"
  ])("classifies %s as release", (path) => {
    expect(classifyChangedPath(path).scope).toBe("release");
  });

  it("falls back to release for an unknown path", () => {
    expect(classifyChangeSet(["public/unclassified.bin"])).toMatchObject({
      scope: "release",
      reason: "unknown_path",
      classifications: [{ category: "unknown_fallback" }]
    });
  });

  it("keeps docs-only and UI-only sets on their intended scopes", () => {
    expect(classifyChangeSet(["README.md", "tests/site.test.mjs"]).scope).toBe("fast");
    expect(classifyChangeSet(["src/pages/index.astro", "src/styles/sunday.css", "tests/site.test.mjs"]).scope).toBe(
      "standard"
    );
  });

  it("elevates mixed scopes to release", () => {
    expect(classifyChangeSet(["src/pages/index.astro", "content-export/data/works.jsonl"])).toMatchObject({
      scope: "release",
      reason: "mixed_scopes"
    });
  });

  it("uses fast when the working tree is empty", () => {
    expect(classifyChangeSet([])).toMatchObject({ scope: "fast", reason: "no_changes" });
  });

  it("discovers tracked and untracked working-tree files", () => {
    const repository = mkdtempSync(join(tmpdir(), "pichugin-change-scope-"));

    try {
      execFileSync("git", ["init", "--quiet"], { cwd: repository });
      writeFileSync(join(repository, "tracked.txt"), "before\n");
      execFileSync("git", ["add", "tracked.txt"], { cwd: repository });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Change Scope Test",
          "-c",
          "user.email=change-scope@example.invalid",
          "commit",
          "--quiet",
          "-m",
          "fixture"
        ],
        { cwd: repository }
      );

      writeFileSync(join(repository, "tracked.txt"), "after\n");
      writeFileSync(join(repository, "untracked.txt"), "new\n");

      expect(getWorkingTreeChanges(repository).changedFiles).toEqual([
        "tracked.txt",
        "untracked.txt"
      ]);
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});
