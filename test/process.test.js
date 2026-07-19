import assert from "node:assert/strict";
import test from "node:test";
import { displayCommand, interpolate, renderCommand } from "../src/process.js";

test("interpolates known placeholders and preserves unknown ones", () => {
  assert.equal(interpolate("{{workspace}}/{{missing}}", { workspace: "/tmp/repo" }), "/tmp/repo/{{missing}}");
  assert.deepEqual(renderCommand(["agent", "--prompt", "{{prompt}}"], { prompt: "fix it" }), ["agent", "--prompt", "fix it"]);
});

test("quotes display arguments containing spaces", () => {
  assert.equal(displayCommand(["agent", "fix it"]), "agent \"fix it\"");
});
