import { cp, mkdir, readdir, realpath } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

const DEFAULT_EXCLUDES = [
  ".git", ".reporace", "node_modules", ".next", "dist", "coverage",
  ".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa", "id_ed25519"
];

function matchesGlob(value, pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

function isExcluded(relativePath, excludes) {
  const normalized = relativePath.split(sep).join("/");
  return excludes.some((item) => {
    if (item.includes("*") && !item.includes("/")) return matchesGlob(normalized.split("/").at(-1), item);
    if (item.endsWith("/**")) return normalized.startsWith(item.slice(0, -3));
    return normalized === item || normalized.startsWith(`${item}/`);
  });
}

export async function copySource(source, destination, extraExcludes = []) {
  const sourceReal = await realpath(source).catch(() => { throw new Error(`Source directory not found: ${source}`); });
  const excludes = [...new Set([...DEFAULT_EXCLUDES, ...extraExcludes.map((item) => item.replace(/^\.\//, ""))])];
  const destinationResolved = resolve(destination);
  await mkdir(destinationResolved, { recursive: true });
  const destinationReal = await realpath(destinationResolved);
  const destinationRelative = relative(sourceReal, destinationReal);
  if (destinationRelative && !destinationRelative.startsWith(`..${sep}`) && destinationRelative !== "..") {
    excludes.push(destinationRelative.split(sep)[0]);
  }

  async function copyDirectory(from, to) {
    for (const entry of await readdir(from, { withFileTypes: true })) {
      const fromPath = join(from, entry.name);
      const relativePath = relative(sourceReal, fromPath);
      if (isExcluded(relativePath, excludes)) continue;
      const toPath = join(to, entry.name);
      if (entry.isDirectory()) {
        await mkdir(toPath, { recursive: true });
        await copyDirectory(fromPath, toPath);
      } else if (entry.isFile()) {
        await cp(fromPath, toPath, { preserveTimestamps: true });
      }
    }
  }

  await copyDirectory(sourceReal, destinationReal);
  return { source: sourceReal, destination: destinationReal, excludes };
}

export function safeSegment(value) {
  return basename(String(value)).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "run";
}
