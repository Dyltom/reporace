import { access, appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";

const config = {
  source: ".",
  runsDir: ".reporace/runs",
  exclude: [".env", ".env.local", "*.pem"],
  agents: {
    codex: {
      command: ["codex", "exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", "{{workspace}}", "-"],
      stdin: "{{prompt}}",
      timeoutMs: 1800000
    },
    claude: {
      command: ["claude", "--print", "--dangerously-skip-permissions", "{{prompt}}"],
      timeoutMs: 1800000
    },
    gemini: {
      command: ["gemini", "--yolo", "--prompt", "{{prompt}}"],
      timeoutMs: 1800000
    }
  }
};

const task = {
  id: "fix-example",
  title: "Fix the documented bug",
  prompt: "Read the repository, reproduce the failing test, fix the root cause, and run the tests. Do not only describe the fix.",
  checks: [{ name: "tests", command: ["npm", "test"], timeoutMs: 300000 }],
  repetitions: 1
};

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

export async function initialize(target = ".", { force = false } = {}) {
  const root = resolve(target);
  const configPath = join(root, "reporace.config.json");
  const tasksDir = join(root, ".reporace", "tasks");
  const taskPath = join(tasksDir, "fix-example.json");
  if (!force && (await exists(configPath) || await exists(taskPath))) {
    throw new Error("RepoRace files already exist. Pass --force to overwrite them.");
  }
  await mkdir(tasksDir, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(taskPath, `${JSON.stringify(task, null, 2)}\n`);
  const gitignorePath = join(root, ".gitignore");
  const current = await readFile(gitignorePath, "utf8").catch(() => "");
  if (!current.split(/\r?\n/).includes(".reporace/runs/")) {
    await appendFile(gitignorePath, `${current && !current.endsWith("\n") ? "\n" : ""}.reporace/runs/\n`);
  }
  return { root, configPath, taskPath };
}
