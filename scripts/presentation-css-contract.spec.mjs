import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPresentationUtilities } from "./presentation-css-contract.mjs";

const required = new Set(["font-display", "lg:px-8", "text-[length:var(--font-size-3xl,1.875rem)]"]);
const css = String.raw`
.font-display { font-family: var(--font-display); }
.lg\:px-8 { @media (width >= 64rem) { padding-inline: 2rem; } }
.text-\[length\:var\(--font-size-3xl\,1\.875rem\)\] { font-size: var(--font-size-3xl,1.875rem); }
`;

test("requires real fallback typography and responsive declarations", () => {
  assert.doesNotThrow(() => assertPresentationUtilities(css, required));
});
test("decodes CSS hex escapes as well as simple escapes", () => {
  assert.doesNotThrow(() => assertPresentationUtilities(String.raw`.lg\3a px-8 {padding:2rem}`, new Set(["lg:px-8"])));
});
test("comments, empty rules and declaration strings cannot satisfy the gate", () => {
  for (const source of ["/* .font-display {font-family:serif} */", ".font-display {}", '.other {content:".font-display"}']) {
    assert.throws(() => assertPresentationUtilities(source, new Set(["font-display"])), /no compiled rule/);
  }
});
test("names the missing renderer class", () => {
  assert.throws(() => assertPresentationUtilities(css, new Set([...required, "flex-wrap"])), /flex-wrap/);
});
test("an empty inventory fails closed", () => {
  assert.throws(() => assertPresentationUtilities(css, new Set()), /no rendered/);
});
test("unprocessed host Tailwind input cannot pass as compiled CSS", () => {
  for (const directive of ["import", "source", "theme", "tailwind"]) {
    assert.throws(() => assertPresentationUtilities(`${css}\n@${directive} 'uncompiled';`, required), /unresolved/);
  }
});
