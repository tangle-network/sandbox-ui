import { test } from "vitest";

test("built public entries share the canonical UI bindings", { timeout: 30_000 }, async () => {
  await import("../../scripts/bridge-consumer.mjs");
});
