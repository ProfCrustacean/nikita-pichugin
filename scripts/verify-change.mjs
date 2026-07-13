#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { classifyChangeSet, getWorkingTreeChanges } from "./change-scope.mjs";

const allowedArguments = new Set(["--dry-run"]);
const unexpectedArguments = process.argv.slice(2).filter((argument) => !allowedArguments.has(argument));

function emit(result) {
  writeFileSync(1, `${JSON.stringify(result, null, 2)}\n`);
}

if (unexpectedArguments.length > 0) {
  emit({
    schemaVersion: 1,
    status: "error",
    error: `Unsupported argument: ${unexpectedArguments.join(", ")}`,
    allowedArguments: [...allowedArguments]
  });
  process.exit(2);
}

const dryRun = process.argv.includes("--dry-run");
let repositoryRoot;
let decision;

try {
  const workingTree = getWorkingTreeChanges();
  repositoryRoot = workingTree.repositoryRoot;
  decision = classifyChangeSet(workingTree.changedFiles);
} catch (error) {
  emit({
    schemaVersion: 1,
    status: "error",
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
}

const command = `npm run check:${decision.scope}`;
const baseResult = {
  schemaVersion: 1,
  status: dryRun ? "dry-run" : "pending",
  dryRun,
  executed: false,
  repositoryRoot,
  command,
  ...decision
};

if (dryRun) {
  emit(baseResult);
  process.exit(0);
}

const startedAt = performance.now();
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const verification = spawnSync(npmExecutable, ["run", `check:${decision.scope}`], {
  cwd: repositoryRoot,
  encoding: "utf8",
  env: { ...process.env, CHANGE_VERIFY_SCOPE: decision.scope },
  maxBuffer: 64 * 1024 * 1024,
  stdio: ["inherit", "pipe", "pipe"]
});

if (verification.stdout) process.stderr.write(verification.stdout);
if (verification.stderr) process.stderr.write(verification.stderr);

const exitCode = verification.status ?? 1;
emit({
  ...baseResult,
  status: exitCode === 0 ? "passed" : "failed",
  executed: true,
  exitCode,
  signal: verification.signal,
  durationMs: Math.round(performance.now() - startedAt),
  error: verification.error?.message
});
process.exit(exitCode);
