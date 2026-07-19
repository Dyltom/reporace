import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/reporace.js", import.meta.url));

test("supports conventional top-level help and version flags", () => {
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  const version = spawnSync(process.execPath, [cli, "--version"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /race coding agents/i);
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^0\.1\.0/);
});
