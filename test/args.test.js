import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs } from "../src/args.js";

test("parses repeatable agents and run options", () => {
  assert.deepEqual(parseArgs(["run", "task.json", "--agent", "codex", "--agent=claude", "--concurrency", "2", "--dry-run", "--json"]), {
    command: "run",
    positionals: ["task.json"],
    flags: { agent: ["codex", "claude"], concurrency: "2", "dry-run": true, json: true }
  });
});

test("rejects unknown and missing options", () => {
  assert.throws(() => parseArgs(["run", "--wat"]), /Unknown option/);
  assert.throws(() => parseArgs(["run", "--agent"]), /Missing value/);
  assert.throws(() => parseArgs(["run", "--dry-run=yes"]), /does not take a value/);
});
