import { test } from "vitest";

test("built public entries share the canonical UI bindings", async () => {
  await import("../../scripts/bridge-consumer.mjs");
});
