import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initialize } from "../src/init.js";

test("initializes config, starter task, and gitignore", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-init-"));
  const result = await initialize(root);
  const config = JSON.parse(await readFile(result.configPath, "utf8"));
  const task = JSON.parse(await readFile(result.taskPath, "utf8"));
  assert.ok(config.agents.codex);
  assert.equal(task.checks[0].name, "tests");
  assert.match(await readFile(join(root, ".gitignore"), "utf8"), /\.reporace\/runs\//);
  await assert.rejects(initialize(root), /already exist/);
});
