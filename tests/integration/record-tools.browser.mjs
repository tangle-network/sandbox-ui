import assert from "node:assert/strict";

export default async function proveRecordedToolPreview(page, transcript) {
  const row = transcript.locator(".record-tool-row").last();
  await row.hover();
  const preview = page.locator(".record-tool-preview");
  await preview.waitFor();
  assert.match(await preview.innerText(), /Duration/);
  assert.match(await preview.innerText(), /Cost/);
  assert.match(await preview.innerText(), /Not recorded/);
  assert.match(await preview.innerText(), /settled/);
  const style = await row.evaluate(node => ({ border: getComputedStyle(node).borderLeftWidth, background: getComputedStyle(node).backgroundColor }));
  assert.equal(style.border, "2px");
  assert.notEqual(style.background, "rgba(0, 0, 0, 0)");
  assert(await preview.evaluate(node => node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth));
  await page.mouse.move(1, 1);
  await preview.waitFor({ state: "hidden" });
}
