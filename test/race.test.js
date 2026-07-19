import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runRace } from "../src/race.js";

test("races agents, grades repository state, and writes reports", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-e2e-"));
  const source = join(root, "source");
  await mkdir(source);
  await writeFile(join(source, "answer.txt"), "wrong\n");
  const fixer = join(root, "fixer.mjs");
  const talker = join(root, "talker.mjs");
  const checker = join(root, "check.mjs");
  await writeFile(fixer, `import { writeFile } from "node:fs/promises"; import { execFileSync } from "node:child_process"; await writeFile("answer.txt", "42\\n"); execFileSync("git", ["add", "answer.txt"]); execFileSync("git", ["-c", "user.name=Test Agent", "-c", "user.email=agent@localhost", "commit", "--quiet", "-m", "fix answer"]); console.log("fixed and committed");`);
  await writeFile(talker, `console.log("Everything is fixed");`);
  await writeFile(checker, `import { readFile } from "node:fs/promises"; process.exit((await readFile("answer.txt", "utf8")).trim() === "42" ? 0 : 1);`);
  const config = {
    source,
    runsDir: join(root, "runs"),
    exclude: [],
    agents: {
      fixer: { command: [process.execPath, fixer] },
      talker: { command: [process.execPath, talker] }
    }
  };
  const task = { id: "answer", title: "Fix answer", prompt: "Make answer 42", repetitions: 1, checks: [{ name: "answer", command: [process.execPath, checker] }] };
  const result = await runRace({ config, task, concurrency: 2 });
  assert.equal(result.summary.passed, 1);
  assert.equal(result.results.find((run) => run.agentId === "fixer").passed, true);
  assert.equal(result.results.find((run) => run.agentId === "talker").passed, false);
  assert.deepEqual(
    {
      filesChanged: result.results.find((run) => run.agentId === "fixer").changes.filesChanged,
      insertions: result.results.find((run) => run.agentId === "fixer").changes.insertions,
      deletions: result.results.find((run) => run.agentId === "fixer").changes.deletions
    },
    { filesChanged: 1, insertions: 1, deletions: 1 }
  );
  assert.match(await readFile(result.results.find((run) => run.agentId === "fixer").changes.patchPath, "utf8"), /-wrong\n\+42/);
  assert.equal(result.results.find((run) => run.agentId === "talker").changes.filesChanged, 0);
  assert.match(await readFile(result.reportPaths.markdown, "utf8"), /fixer.*PASS/);
  assert.match(await readFile(result.reportPaths.html, "utf8"), /Same task\. Isolated workspaces\. Checks decide\./);
  await access(result.reportPaths.json);
  for (const run of result.results) await assert.rejects(access(join(run.runDir, "workspace")));
});

test("dry-run renders plan without creating artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-dry-"));
  const config = { source: root, runsDir: join(root, "runs"), exclude: [], agents: { fake: { command: ["fake", "{{prompt}}"] } } };
  const task = { id: "dry", title: "Dry", prompt: "Fix it", checks: [{ name: "tests", command: "npm test" }], repetitions: 1 };
  const result = await runRace({ config, task, dryRun: true });
  assert.match(result.plan, /fake "Fix it"/);
  await assert.rejects(access(config.runsDir));
});
