import assert from "node:assert/strict";
import test from "node:test";
import { access, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { copySource, safeSegment } from "../src/workspace.js";

async function missing(path) {
  try { await access(path); return false; } catch { return true; }
}

test("copies source while excluding secrets, dependencies, output, and symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-copy-"));
  const source = join(root, "source");
  const destination = join(root, "destination");
  await mkdir(join(source, "node_modules"), { recursive: true });
  await writeFile(join(source, "index.js"), "ok");
  await writeFile(join(source, ".env"), "SECRET=x");
  await writeFile(join(source, ".env.production"), "SECRET=y");
  await writeFile(join(source, "private.pem"), "key");
  await writeFile(join(source, "node_modules", "dep.js"), "dep");
  await symlink(join(source, ".env"), join(source, "secret-link"));
  await copySource(source, destination, [".env", "*.pem"]);
  assert.equal(await missing(join(destination, "index.js")), false);
  assert.equal(await missing(join(destination, ".env")), true);
  assert.equal(await missing(join(destination, ".env.production")), true);
  assert.equal(await missing(join(destination, "private.pem")), true);
  assert.equal(await missing(join(destination, "node_modules")), true);
  assert.equal(await missing(join(destination, "secret-link")), true);
});

test("does not recursively copy an artifact directory inside source", async () => {
  const root = await mkdtemp(join(tmpdir(), "reporace-recursion-"));
  const destination = join(root, "artifacts", "one", "workspace");
  await writeFile(join(root, "index.js"), "ok");
  await copySource(root, destination);
  assert.equal(await missing(join(destination, "index.js")), false);
  assert.equal(await missing(join(destination, "artifacts")), true);
});

test("sanitizes artifact path segments", () => {
  assert.equal(safeSegment("../../evil task"), "evil-task");
});
