# Broken calculator example

This fixture has one deliberately wrong tax calculation and one failing test.
It provides a tiny real-agent smoke test without touching the RepoRace source.

```bash
node ../../bin/reporace.js run task.json \
  --config reporace.config.json \
  --dry-run

node ../../bin/reporace.js run task.json \
  --config reporace.config.json \
  --agent codex
```

The original `source/` stays broken. RepoRace fixes and checks only its
disposable copy under `runs/`.
