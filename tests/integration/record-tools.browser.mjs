import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

export default async function proveRecordedToolPreview(page, transcript, { lane, width, mode }) {
  const row = transcript.locator(".record-tool-row").last();
  await page.mouse.move(1, 1);
  const summary = row.locator('[data-record-tool-summary]');
  assert.match(await summary.innerText(), /Returned/);
  assert(await summary.evaluate(node => getComputedStyle(node).opacity === '1' && node.getBoundingClientRect().width > 40));
  assert(await row.evaluate(node => { const a = node.getBoundingClientRect(), b = node.querySelector('[data-record-tool-summary]').getBoundingClientRect(); return b.right <= a.right && b.right >= a.right - 16; }), 'duration and result stay inside the colored row right edge');
  const logos = transcript.locator('[data-record-harness-logos] > span');
  assert.equal(await logos.count(), 6);
  for (const logo of await logos.all()) {
    assert.match(await logo.getAttribute('title'), /Recorded model/);
    if (await logo.getAttribute('aria-label') === 'Kimi') assert(await logo.evaluate(node => getComputedStyle(node).backgroundColor.match(/[\d.]+/g).slice(0, 3).every(value => Number(value) > 230)), 'the original black/blue Kimi mark retains a light backing in both themes');
    assert(await logo.evaluate(node => { const box = node.getBoundingClientRect(), color = getComputedStyle(node).backgroundColor; const glyph = node.firstElementChild.getBoundingClientRect(); return box.width >= 28 && glyph.width >= 16 && color !== 'rgba(0, 0, 0, 0)' }));
  }
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
  if (process.env.RECORD_TOOL_PROOF_DIR) {
    const root = process.env.RECORD_TOOL_PROOF_DIR; await mkdir(root, { recursive: true });
    await page.screenshot({ path: `${root}/tool-${lane}-${width}-${mode}-${process.env.PACKAGE_OMIT_OPTIONAL_PEERS ? "omitted" : "normal"}.png` });
  }
  await page.mouse.move(1, 1);
  await preview.waitFor({ state: "hidden" });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await transcript.getByRole("button", { name: "Append live turn", exact: true }).click();
  await transcript.getByText("Live turn 1", { exact: true }).waitFor();
  await transcript.getByRole("button", { name: "Append live turn", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-entry="arrival-1"]')?.getAnimations().some(a => a.playState === "running"));
  const motion = await transcript.locator('[data-entry="arrival-1"]').evaluate(async node => {
    const animations = node.getAnimations(), frames = animations.flatMap(a => a.effect.getKeyframes());
    await Promise.all(animations.map(a => a.finished)); return frames;
  });
  assert(motion.some(frame => Number(frame.opacity) === 0) && motion.some(frame => Number(frame.opacity) === 1));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await transcript.getByRole("button", { name: "Append live turn", exact: true }).click();
  await transcript.getByText("Live turn 3", { exact: true }).waitFor();
  assert.equal(await transcript.locator('[data-entry="arrival-2"]').evaluate(node => node.getAnimations().length), 0);
}
