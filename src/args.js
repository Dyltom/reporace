const VALUE_FLAGS = new Set(["config", "agent", "concurrency", "runs-dir"]);
const BOOLEAN_FLAGS = new Set(["dry-run", "keep-workspaces", "json", "help", "version", "force"]);

export function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const positionals = [];
  const flags = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [rawName, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (BOOLEAN_FLAGS.has(rawName)) {
      if (inlineValue !== undefined) throw new Error(`--${rawName} does not take a value`);
      flags[rawName] = true;
      continue;
    }
    if (!VALUE_FLAGS.has(rawName)) throw new Error(`Unknown option: --${rawName}`);

    const value = inlineValue ?? rest[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${rawName}`);
    if (rawName === "agent") flags.agent = [...(flags.agent ?? []), value];
    else flags[rawName] = value;
  }

  return { command, positionals, flags };
}
