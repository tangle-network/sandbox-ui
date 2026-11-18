import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

export async function proveMotionPolicy(page, { lane, width, mode, mediaDir }) {
  const control = page.getByRole("button", { name: "Change consumer theme", exact: true }), samples = [];
  for (const preference of ["no-preference", "reduce"]) {
    await page.emulateMedia({ reducedMotion: preference });
    await control.click();
    const observed = await page.evaluate(() => JSON.parse(document.documentElement.dataset.motionObservation));
    samples.push({ preference, ...observed });
    console.log(JSON.stringify({ check: "packed-motion-atomic", lane, width, mode, ...samples.at(-1) }));
    assert.equal(observed.reduced, preference === "reduce");
    const ordinary = observed.transitions.filter(item => !item.essential);
    if (observed.reduced) assert.deepEqual(ordinary, [], "reduced motion starts no nonessential transition, including document scrollbars");
    else assert(ordinary.some(item => item.sample === "ordinary" && item.duration === 200), "the same ordinary transition runs normally");
    for (const name of ["essential", "descendant"]) assert(observed.transitions.some(item => item.sample === name && item.essential && item.duration === 200), "essential elements and descendants retain caller motion");
    await control.hover();
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, -160);
    await page.waitForFunction(top => scrollY < top, before);
    if (mediaDir) await page.screenshot({ path: `${mediaDir}/motion-${preference}.png` });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  return samples;
}
