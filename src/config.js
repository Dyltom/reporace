import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";

const CONFIG_NAME = "reporace.config.json";

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`${label} not found: ${path}`);
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label} ${path}: ${error.message}`);
  }
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} must be a non-empty string`);
}

function validateCommand(value, path) {
  const validArray = Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string");
  if (typeof value !== "string" && !validArray) {
    throw new Error(`${path} must be a shell string or non-empty string array`);
  }
}

export async function findConfig(start = process.cwd()) {
  let current = resolve(start);
  while (true) {
    const candidate = resolve(current, CONFIG_NAME);
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch {}
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`Could not find ${CONFIG_NAME}. Run \`reporace init\` first or pass --config.`);
}

export async function loadConfig(explicitPath, cwd = process.cwd()) {
  const path = explicitPath ? resolve(cwd, explicitPath) : await findConfig(cwd);
  const value = await readJson(path, "config");
  if (!value.agents || typeof value.agents !== "object" || Array.isArray(value.agents)) {
    throw new Error("config.agents must be an object");
  }
  for (const [id, agent] of Object.entries(value.agents)) {
    requireString(id, "agent id");
    if (!agent || typeof agent !== "object") throw new Error(`config.agents.${id} must be an object`);
    validateCommand(agent.command, `config.agents.${id}.command`);
    if (agent.timeoutMs !== undefined && (!Number.isInteger(agent.timeoutMs) || agent.timeoutMs <= 0)) {
      throw new Error(`config.agents.${id}.timeoutMs must be a positive integer`);
    }
  }
  return {
    path,
    directory: dirname(path),
    source: resolve(dirname(path), value.source ?? "."),
    runsDir: resolve(dirname(path), value.runsDir ?? ".reporace/runs"),
    exclude: value.exclude ?? [],
    agents: value.agents
  };
}

export async function loadTask(taskPath, cwd = process.cwd()) {
  if (!taskPath) throw new Error("Task path required. Example: reporace run .reporace/tasks/fix-bug.json");
  const path = resolve(cwd, taskPath);
  const task = await readJson(path, "task");
  requireString(task.id, "task.id");
  requireString(task.title, "task.title");
  requireString(task.prompt, "task.prompt");
  if (!Array.isArray(task.checks) || task.checks.length === 0) throw new Error("task.checks must contain at least one check");
  for (const [index, check] of task.checks.entries()) {
    requireString(check.name, `task.checks[${index}].name`);
    validateCommand(check.command, `task.checks[${index}].command`);
  }
  if (task.setup !== undefined && !Array.isArray(task.setup)) throw new Error("task.setup must be an array");
  for (const [index, step] of (task.setup ?? []).entries()) {
    requireString(step.name, `task.setup[${index}].name`);
    validateCommand(step.command, `task.setup[${index}].command`);
  }
  if (task.repetitions !== undefined && (!Number.isInteger(task.repetitions) || task.repetitions <= 0)) {
    throw new Error("task.repetitions must be a positive integer");
  }
  return { ...task, path, directory: dirname(path), repetitions: task.repetitions ?? 1 };
}
