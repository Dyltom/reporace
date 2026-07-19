import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, loadTask } from "../src/config.js";

test("loads config and resolves paths relative to config", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-config-"));
  await writeFile(join(root, "reporace.config.json"), JSON.stringify({ source: "fixture", agents: { fake: { command: ["node", "fake.js"] } } }));
  const config = await loadConfig(undefined, root);
  assert.equal(config.source, join(root, "fixture"));
  assert.equal(config.runsDir, join(root, ".reporace", "runs"));
  assert.deepEqual(config.agents.fake.command, ["node", "fake.js"]);
});

test("validates task checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-task-"));
  const path = join(root, "task.json");
  await writeFile(path, JSON.stringify({ id: "bug", title: "Fix bug", prompt: "Fix it", checks: [] }));
  await assert.rejects(loadTask(path), /at least one check/);
});

test("reports malformed JSON with its file", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-json-"));
  const path = join(root, "task.json");
  await writeFile(path, "{");
  await assert.rejects(loadTask(path), /Invalid JSON.*task\.json/);
});
