import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { copySource, safeSegment } from "./workspace.js";
import { displayCommand, interpolate, renderCommand, runCommand } from "./process.js";
import { renderHtmlReport, renderMarkdownReport } from "./report.js";
import { captureChanges, createBaseline } from "./git.js";

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function consume() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume));
  return results;
}

function commandPlan(task, agents) {
  const context = { workspace: "<workspace>", prompt: task.prompt, promptFile: "<prompt-file>", taskId: task.id, runDir: "<run-dir>" };
  return agents.flatMap(([id, agent]) => [
    `${id}: ${displayCommand(renderCommand(agent.command, context))}`,
    ...(task.setup ?? []).map((step) => `  setup/${step.name}: ${displayCommand(renderCommand(step.command, context))}`),
    ...task.checks.map((check) => `  check/${check.name}: ${displayCommand(renderCommand(check.command, context))}`)
  ]).join("\n");
}

export async function runRace({ config, task, agentIds, concurrency = 1, keepWorkspaces = false, dryRun = false, runsDir }) {
  const selectedIds = agentIds?.length ? agentIds : Object.keys(config.agents);
  const unknown = selectedIds.filter((id) => !config.agents[id]);
  if (unknown.length) throw new Error(`Unknown agent${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`);
  const agents = selectedIds.map((id) => [id, config.agents[id]]);
  if (dryRun) return { dryRun: true, plan: commandPlan(task, agents) };

  const raceDir = resolve(runsDir ?? config.runsDir, `${stamp()}-${safeSegment(task.id)}`);
  await mkdir(raceDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const jobs = agents.flatMap(([agentId, agent]) => Array.from({ length: task.repetitions }, (_, index) => ({ agentId, agent, repetition: index + 1 })));

  const results = await pool(jobs, concurrency, async ({ agentId, agent, repetition }) => {
    const runName = `${safeSegment(agentId)}-${repetition}`;
    const runDir = join(raceDir, runName);
    const workspace = join(runDir, "workspace");
    const logsDir = join(runDir, "logs");
    await copySource(config.source, workspace, config.exclude);
    const promptFile = join(runDir, "prompt.md");
    await writeFile(promptFile, task.prompt);
    const context = { workspace, prompt: task.prompt, promptFile, taskId: task.id, runDir };

    const setup = [];
    for (const step of task.setup ?? []) {
      const result = await runCommand({
        command: renderCommand(step.command, context), cwd: workspace, env: step.env,
        timeoutMs: step.timeoutMs, stdoutPath: join(logsDir, `setup-${safeSegment(step.name)}.stdout.log`),
        stderrPath: join(logsDir, `setup-${safeSegment(step.name)}.stderr.log`)
      });
      setup.push({ name: step.name, ...result, passed: result.code === 0 && !result.timedOut });
      if (!setup.at(-1).passed) break;
    }

    const setupPassed = setup.every((step) => step.passed);
    const baseline = setupPassed
      ? await createBaseline({ workspace, logsDir })
      : { available: false, error: "Skipped because setup failed" };
    const renderedAgentCommand = renderCommand(agent.command, context);
    const agentResult = setupPassed ? await runCommand({
      command: renderedAgentCommand, cwd: workspace, env: agent.env,
      stdin: agent.stdin === undefined ? undefined : interpolate(agent.stdin, context),
      timeoutMs: agent.timeoutMs ?? 1_800_000,
      stdoutPath: join(logsDir, "agent.stdout.log"), stderrPath: join(logsDir, "agent.stderr.log")
    }) : { code: null, signal: null, error: "Skipped because setup failed", timedOut: false, durationMs: 0, command: renderedAgentCommand };

    const checks = [];
    if (setupPassed) {
      for (const check of task.checks) {
        const result = await runCommand({
          command: renderCommand(check.command, context), cwd: workspace, env: check.env,
          timeoutMs: check.timeoutMs, stdoutPath: join(logsDir, `check-${safeSegment(check.name)}.stdout.log`),
          stderrPath: join(logsDir, `check-${safeSegment(check.name)}.stderr.log`)
        });
        checks.push({ name: check.name, ...result, passed: result.code === 0 && !result.timedOut });
      }
    }
    const passed = setupPassed && agentResult.code === 0 && !agentResult.timedOut && checks.every((check) => check.passed);
    const changes = await captureChanges({ workspace, runDir, logsDir, baseline });
    const value = { agentId, repetition, passed, setup, agent: agentResult, checks, changes, workspace: keepWorkspaces ? workspace : null, runDir };
    await writeFile(join(runDir, "result.json"), JSON.stringify(value, null, 2));
    if (!keepWorkspaces) await rm(workspace, { recursive: true, force: true });
    return value;
  });

  const result = {
    schemaVersion: 1,
    task: { id: task.id, title: task.title, path: task.path },
    startedAt,
    finishedAt: new Date().toISOString(),
    source: config.source,
    results,
    summary: { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length },
    reportPaths: { json: join(raceDir, "result.json"), markdown: join(raceDir, "report.md"), html: join(raceDir, "report.html") }
  };
  await writeFile(result.reportPaths.json, JSON.stringify(result, null, 2));
  await writeFile(result.reportPaths.markdown, renderMarkdownReport(result));
  await writeFile(result.reportPaths.html, renderHtmlReport(result));
  return result;
}
