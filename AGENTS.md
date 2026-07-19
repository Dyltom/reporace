# Agent instructions

RepoRace is a zero-runtime-dependency Node.js CLI.

- Use Node.js 20+ built-ins. Do not add a runtime dependency without explaining
  why built-ins are insufficient.
- Keep pass/fail deterministic. Never let an LLM judge decide the core verdict.
- Treat configured commands, prompts, and source repositories as untrusted.
- Preserve source repositories. All mutations belong in disposable workspaces.
- Add or update tests for behavior changes.
- Run `npm run check` before claiming completion.
