#!/usr/bin/env node

import { main } from "../src/cli.js";

main(process.argv.slice(2)).catch((error) => {
  console.error(`\nRepoRace error: ${error.message}`);
  if (process.env.REPORACE_DEBUG === "1") console.error(error.stack);
  process.exitCode = 1;
});
