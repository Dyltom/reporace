import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { finished } from "node:stream/promises";

export function interpolate(value, context) {
  return value.replace(/\{\{(\w+)\}\}/g, (match, key) => key in context ? String(context[key]) : match);
}

export function renderCommand(command, context) {
  return Array.isArray(command)
    ? command.map((part) => interpolate(part, context))
    : interpolate(command, context);
}

export function displayCommand(command) {
  if (typeof command === "string") return command;
  return command.map((part) => /^[A-Za-z0-9_./:=@+-]+$/.test(part) ? part : JSON.stringify(part)).join(" ");
}

export async function runCommand({ command, cwd, env = {}, stdin, timeoutMs = 300_000, stdoutPath, stderrPath }) {
  await Promise.all([mkdir(dirname(stdoutPath), { recursive: true }), mkdir(dirname(stderrPath), { recursive: true })]);
  const stdout = createWriteStream(stdoutPath);
  const stderr = createWriteStream(stderrPath);
  const startedAt = Date.now();
  const child = Array.isArray(command)
    ? spawn(command[0], command.slice(1), { cwd, env: { ...process.env, ...env }, shell: false, stdio: ["pipe", "pipe", "pipe"] })
    : spawn(command, { cwd, env: { ...process.env, ...env }, shell: true, stdio: ["pipe", "pipe", "pipe"] });

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  const streamsFinished = Promise.all([finished(stdout), finished(stderr)]);
  if (stdin !== undefined) child.stdin.end(stdin);
  else child.stdin.end();

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
  }, timeoutMs);

  const exit = await new Promise((done) => {
    child.once("error", (error) => done({ code: null, signal: null, error: error.message }));
    child.once("exit", (code, signal) => done({ code, signal }));
  });
  clearTimeout(timer);
  stdout.end();
  stderr.end();
  await streamsFinished;

  return { ...exit, timedOut, durationMs: Date.now() - startedAt, command, stdoutPath, stderrPath };
}
