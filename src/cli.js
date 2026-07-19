import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "./args.js";
import { loadConfig, loadTask } from "./config.js";
import { initialize } from "./init.js";
import { runRace } from "./race.js";
import { consoleSummary, renderHtmlReport, renderMarkdownReport } from "./report.js";

const VERSION = "0.1.0";
const HELP = `RepoRace — race coding agents. Checks decide.

Usage:
  reporace init [directory] [--force]
  reporace agents [--config path]
  reporace run <task.json> [options]
  reporace report <result.json>

Run options:
  --agent <id>          Agent to run; repeat for multiple agents
  --concurrency <n>     Parallel runs (default: 1)
  --config <path>       Config file (default: nearest reporace.config.json)
  --runs-dir <path>     Override artifact directory
  --keep-workspaces     Preserve disposable workspaces after checks
  --dry-run             Print commands without executing them
  --json                Emit machine-readable stdout

Safety:
  Agent commands execute with your user permissions and inherited environment.
  Run only trusted tasks and inspect \`reporace run ... --dry-run\` first.`;

export async function main(argv) {
  if (argv[0] === "--help" || argv[0] === "-h") return console.log(HELP);
  if (argv[0] === "--version" || argv[0] === "-v") return console.log(VERSION);
  const { command, positionals, flags } = parseArgs(argv);
  if (command === "help" || flags.help) return console.log(HELP);
  if (command === "version" || flags.version) return console.log(VERSION);

  if (command === "init") {
    const result = await initialize(positionals[0] ?? ".", { force: flags.force });
    console.log(`RepoRace initialized in ${result.root}\nTask: ${result.taskPath}\n\nNext: reporace run ${result.taskPath} --dry-run`);
    return;
  }

  if (command === "agents") {
    const config = await loadConfig(flags.config);
    if (flags.json) return console.log(JSON.stringify(config.agents, null, 2));
    for (const [id, agent] of Object.entries(config.agents)) console.log(`${id}\t${Array.isArray(agent.command) ? agent.command.join(" ") : agent.command}`);
    return;
  }

  if (command === "run") {
    const [config, task] = await Promise.all([loadConfig(flags.config), loadTask(positionals[0])]);
    const concurrency = Number(flags.concurrency ?? 1);
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error("--concurrency must be an integer from 1 to 32");
    const result = await runRace({ config, task, agentIds: flags.agent, concurrency, keepWorkspaces: flags["keep-workspaces"], dryRun: flags["dry-run"], runsDir: flags["runs-dir"] });
    if (result.dryRun) {
      if (flags.json) return console.log(JSON.stringify(result, null, 2));
      console.log(`Commands that will execute:\n\n${result.plan}\n\nAgent subprocesses inherit your environment. Run only trusted tasks.`);
      return;
    }
    if (flags.json) {
      console.log(JSON.stringify({ summary: result.summary, reportPaths: result.reportPaths }, null, 2));
      if (result.summary.passed === 0) process.exitCode = 1;
      return;
    }
    console.log(consoleSummary(result));
    if (result.summary.passed === 0) process.exitCode = 1;
    return;
  }

  if (command === "report") {
    if (!positionals[0]) throw new Error("Result path required");
    const path = resolve(positionals[0]);
    const result = JSON.parse(await readFile(path, "utf8"));
    const markdownPath = path.replace(/\.json$/, ".md");
    const htmlPath = path.replace(/\.json$/, ".html");
    await Promise.all([writeFile(markdownPath, renderMarkdownReport(result)), writeFile(htmlPath, renderHtmlReport(result))]);
    console.log(`Reports written:\n${markdownPath}\n${htmlPath}`);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${HELP}`);
}
