# Claude Code and Codex smoke test

This is the evidence behind RepoRace's demo—not a synthetic leaderboard.

Run on 19 July 2026 with:

- Claude Code 2.1.206, using its default model and local configuration
- Codex CLI 0.144.1, using its default model and local configuration
- the committed [`fix-calculator`](../examples/fix-calculator/) fixture
- one repetition per agent
- `npm test` as the sole deterministic check

Both agents received this exact prompt:

> The calculator's tax behavior is wrong. Reproduce the test failure, fix the
> root cause, and run the tests. Keep the public function signature unchanged.

## Result

| Rank | Agent | Verdict | Agent time | Checks | Changed files |
| ---: | --- | --- | ---: | ---: | ---: |
| 1 | Claude Code | PASS | 42.7s | 1/1 | 1 |
| 2 | Codex | PASS | 1.7m | 1/1 | 1 |

Each agent independently produced the same one-line patch:

```diff
 export function totalWithTax(subtotal, taxRate) {
-  return subtotal + taxRate;
+  return subtotal + subtotal * taxRate;
 }
```

RepoRace captured each prompt, process result, test result, and patch from an
isolated workspace. The original fixture stayed unchanged.

This tiny fixture proves the harness works with both real CLIs. It does **not**
claim one agent is generally better, and the timings are not controlled model
benchmarks. Useful comparisons need multiple representative tasks, pinned
versions and models, and repeated runs.
