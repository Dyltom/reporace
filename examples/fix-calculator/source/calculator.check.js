import assert from "node:assert/strict";
import test from "node:test";
import { totalWithTax } from "./calculator.js";

test("adds percentage tax to subtotal", () => {
  assert.equal(totalWithTax(100, 0.1), 110);
  assert.equal(totalWithTax(50, 0.2), 60);
});
