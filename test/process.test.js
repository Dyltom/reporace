import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { displayCommand, interpolate, renderCommand, runCommand } from "../src/process.js";

test("interpolates known placeholders and preserves unknown ones", () => {
  assert.equal(interpolate("{{workspace}}/{{missing}}", { workspace: "/tmp/repo" }), "/tmp/repo/{{missing}}");
  assert.deepEqual(renderCommand(["agent", "--prompt", "{{prompt}}"], { prompt: "fix it" }), ["agent", "--prompt", "fix it"]);
});

test("quotes display arguments containing spaces", () => {
  assert.equal(displayCommand(["agent", "fix it"]), "agent \"fix it\"");
});

test("flushes short child output before returning", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reporace-process-"));

  try {
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const stdoutPath = join(directory, `stdout-${iteration}.log`);
      const result = await runCommand({
        command: [process.execPath, "-e", "process.stdout.write('revision\\n')"],
        cwd: directory,
        stdoutPath,
        stderrPath: join(directory, `stderr-${iteration}.log`)
      });

      assert.equal(result.code, 0);
      assert.equal(await readFile(stdoutPath, "utf8"), "revision\n");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
