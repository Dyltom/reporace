import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "./process.js";

async function git({ args, cwd, logsDir, name, stdoutPath }) {
  return runCommand({
    command: ["git", ...args],
    cwd,
    timeoutMs: 120_000,
    stdoutPath: stdoutPath ?? join(logsDir, `${name}.stdout.log`),
    stderrPath: join(logsDir, `${name}.stderr.log`)
  });
}

export async function createBaseline({ workspace, logsDir }) {
  const init = await git({ args: ["init", "--quiet"], cwd: workspace, logsDir, name: "baseline-init" });
  if (init.code !== 0) return { available: false, error: init.error ?? "git init failed" };
  const add = await git({ args: ["add", "-A"], cwd: workspace, logsDir, name: "baseline-add" });
  if (add.code !== 0) return { available: false, error: add.error ?? "git add failed" };
  const commit = await git({
    args: ["-c", "user.name=RepoRace", "-c", "user.email=reporace@localhost", "commit", "--quiet", "--allow-empty", "-m", "RepoRace baseline"],
    cwd: workspace,
    logsDir,
    name: "baseline-commit"
  });
  if (commit.code !== 0) return { available: false, error: commit.error ?? "git commit failed" };
  const revision = await git({ args: ["rev-parse", "HEAD"], cwd: workspace, logsDir, name: "baseline-revision" });
  if (revision.code !== 0) return { available: false, error: revision.error ?? "git rev-parse failed" };
  return { available: true, revision: (await readFile(revision.stdoutPath, "utf8")).trim() };
}

function summarizeNumstat(text) {
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of text.trim().split("\n")) {
    if (!line) continue;
    const [added, removed] = line.split("\t");
    filesChanged += 1;
    if (added !== "-") insertions += Number(added);
    if (removed !== "-") deletions += Number(removed);
  }
  return { filesChanged, insertions, deletions };
}

export async function captureChanges({ workspace, runDir, logsDir, baseline }) {
  if (!baseline.available) return { available: false, error: baseline.error };
  const intent = await git({ args: ["add", "--intent-to-add", "."], cwd: workspace, logsDir, name: "changes-intent" });
  if (intent.code !== 0) return { available: false, error: intent.error ?? "git add --intent-to-add failed" };

  const patchPath = join(runDir, "changes.patch");
  const patch = await git({
    args: ["diff", "--binary", "--no-ext-diff", baseline.revision, "--", "."],
    cwd: workspace,
    logsDir,
    name: "changes-patch",
    stdoutPath: patchPath
  });
  if (patch.code !== 0) return { available: false, error: patch.error ?? "git diff failed" };
  const numstat = await git({
    args: ["diff", "--numstat", "--no-ext-diff", baseline.revision, "--", "."],
    cwd: workspace,
    logsDir,
    name: "changes-numstat"
  });
  if (numstat.code !== 0) return { available: false, error: numstat.error ?? "git diff --numstat failed" };
  const summary = summarizeNumstat(await readFile(numstat.stdoutPath, "utf8"));
  return { available: true, patchPath, ...summary };
}
