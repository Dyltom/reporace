# RepoRace

**Race coding agents on real repository tasks. Tests decide the winner.**

Codex says it fixed the bug. Claude says the same. RepoRace gives each agent an
identical disposable copy, the same prompt, and the same deterministic checks.
Then it produces a replayable JSON, Markdown, and HTML result instead of a vibe.

```text
PASS  codex            run 1    42.1s  2/2 checks
FAIL  claude           run 1    31.8s  1/2 checks
FAIL  gemini           run 1    55.4s  0/2 checks
```

No API wrapper. No LLM judge. No account. Zero runtime dependencies.

## Why RepoRace

Model benchmarks rarely answer the practical question: **which coding agent
works best on this repository, with this task, under the checks we actually
trust?**

RepoRace runs installed coding CLIs—Codex, Claude Code, Gemini CLI, or any
custom command—inside separate source copies. A run passes only when the agent
exits successfully and every configured check passes.

| | RepoRace | Prompt/model evals | SWE-bench runners |
| --- | --- | --- | --- |
| Your real repository | Yes | Sometimes | No |
| Real coding CLI | Yes | Usually no | Harness-specific |
| Deterministic verdict | Yes | Often LLM-judged | Yes |
| Setup time | Minutes | Varies | Hours |
| Runtime service | None | Often | Usually |

## Quick start

Requires Node.js 20+ and at least one coding-agent CLI.

```bash
npx reporace init

# Edit the generated task prompt and checks, then inspect commands first.
npx reporace run .reporace/tasks/fix-example.json --dry-run

# Run one agent.
npx reporace run .reporace/tasks/fix-example.json --agent codex

# Race three agents, two at a time.
npx reporace run .reporace/tasks/fix-example.json \
  --agent codex --agent claude --agent gemini --concurrency 2

# Give another agent or CI a parseable summary.
npx reporace run .reporace/tasks/fix-example.json --agent codex --json
```

Artifacts land under `.reporace/runs/<timestamp>-<task>/`:

- `result.json` — machine-readable full result
- `report.md` — shareable leaderboard
- `report.html` — standalone visual report
- `<agent>-<run>/logs/` — stdout and stderr for agent, setup, and checks
- `<agent>-<run>/prompt.md` — exact task sent to the agent

`--json` keeps stdout machine-readable and returns summary plus artifact paths.
The complete, versioned result always lives in `result.json`; its schema ships
as `schema/result.schema.json`.

## Define a task

```json
{
  "id": "fix-cart-total",
  "title": "Fix discounted cart totals",
  "prompt": "Reproduce the discounted-cart failure, fix its root cause, and run tests.",
  "setup": [
    { "name": "install", "command": ["npm", "ci"], "timeoutMs": 300000 }
  ],
  "checks": [
    { "name": "unit", "command": ["npm", "test"] },
    { "name": "types", "command": ["npm", "run", "typecheck"] }
  ],
  "repetitions": 3
}
```

Commands may be argument arrays (safer, cross-platform) or shell strings. Checks
run after the agent even if its process exits non-zero, because the repository
state—not the agent's confidence—is the useful evidence.

## Configure agents

`reporace init` writes verified defaults for currently installed Codex, Claude,
and Gemini CLIs:

```json
{
  "source": ".",
  "runsDir": ".reporace/runs",
  "exclude": [".env", ".env.local", "*.pem"],
  "agents": {
    "codex": {
      "command": ["codex", "exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", "{{workspace}}", "-"],
      "stdin": "{{prompt}}",
      "timeoutMs": 1800000
    },
    "my-agent": {
      "command": ["my-agent", "solve", "--prompt-file", "{{promptFile}}"],
      "env": { "MY_AGENT_MODE": "test" }
    }
  }
}
```

Available placeholders:

- `{{workspace}}` — disposable source copy
- `{{prompt}}` — task prompt
- `{{promptFile}}` — file containing exact prompt
- `{{taskId}}` — task ID
- `{{runDir}}` — artifact directory for this run

Run `reporace agents` to inspect configured commands.

## Fair races

- Pin agent versions and models when publishing comparisons.
- Use identical task text and checks.
- Run multiple repetitions for nondeterministic agents.
- Keep setup deterministic (`npm ci`, locked dependencies, fixed fixtures).
- Publish complete artifacts, including failures.
- Do not treat one repository task as a universal model ranking.

## Security

RepoRace isolates **repository state**, not your operating system. Configured
commands run as your user and inherit environment variables. Agent CLIs may read
credentials, access the network, or execute arbitrary code.

Only run trusted tasks and repositories. Inspect `--dry-run` output. Use a
container or disposable VM when evaluating untrusted prompts or code. `.env`,
private keys, dependencies, build output, Git metadata, and prior RepoRace runs
are excluded from workspace copies by default.

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Development

```bash
npm test
npm run test:coverage
npm run check
```

RepoRace is MIT licensed. Contributions welcome—especially adapters, Windows
coverage, report improvements, and real-world task examples.
