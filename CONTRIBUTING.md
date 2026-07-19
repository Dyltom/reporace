# Contributing

Thanks for improving RepoRace.

## Before opening a change

1. Search existing issues.
2. Keep verdicts deterministic. LLM judges may add context but must never replace
   configured pass/fail checks.
3. Avoid runtime dependencies unless they remove substantial complexity.
4. Preserve JSON result compatibility or document the schema change.

## Local checks

```bash
npm test
npm run test:coverage
npm run check
```

Pull requests should explain the user problem, include tests, and note security
or cross-platform effects. Small, focused changes are easiest to review.
