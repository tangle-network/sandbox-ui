**Verdict: Wave 1 partly landed.** Kind separation and the green wall are fixed. Emphasis inversion is not: the loudest pixels in `after-succeeded.png` are still the success bars. None of the three shots has a failed, running or waiting node, so I can't confirm the new FAILED/WAITING/RUNNING treatments. I'm not scoring them.

I compared against your earlier findings and scores, not the original PNGs.

## Scores (before → after)

| Axis | Before | After | Pixel evidence |
|---|---|---|---|
| A. Kind vs state channel | 3 | **7** | The 2px top rule (indigo/indigo/blue in succeeded) and tinted tiles carry kind. Borders are neutral and visible. Sandbox and Parallel are now plain grey tiles, so "structural" reads as "uncolored", not as a kind. GitHub, Builder and AI Agent tiles are near-identical dark navy. |
| B. Emphasis inversion | 2 | **4** | Done pills are neutral with no ring, so DONE is quiet. But the 4–5px full-width mint bars at `after-succeeded.png` AI Agent (y≈714) and Notify (y≈723) are the brightest things in the frame. Schedule has no bar. FAILED is unverifiable. |
| C. Green wall | 2 | **8** | Every settled edge is grey, thin, with small arrowheads. No green remains. The cost is that nothing shows which branch actually ran. |
| D. Depth | 3 | **6** | The shadow is visible under the succeeded cards. Borders are readable on dark. In compact mode the cards are navy on a flat grey (#171717) canvas, inside a purple-navy panel, inside a near-black page. The canvas still reads as a hole, not a surface. |
| E. Intention jobs | | | |
| – topology | 6 | 7 | Branching in `after-mixed.png` is clear, and edge noise is gone. |
| – misconfig | 2 | 2 | No shot shows an invalid or unconfigured state. |
| – trust | 4 | 5 | Done is calmer. Output and cost are present but tiny. |
| – find-stuck | 5 | 5 | Unverifiable, because no stuck node appears in any frame. |
| – cost | 2 | 3 | `$0.0023 · 210/48 tok` is about 10px dim grey in one footer only. |

## Still looks bad (top 5)

1. **Success bars shout.** The full-width mint footer rules on the AI Agent and Notify cards contradict "done is quiet". They are also inconsistent, since Schedule has none.
2. **Compact tile halo reads as state.** In `after-linear.png` every tile has a diffuse light glow. It looks like the WAITING or selected glow, so a resting node resembles a live one.
3. **Compact labels are tiny.** In `after-mixed.png` the labels are about 10px and the subtitles about 9px, grey on near-black. They are hard to read at 1440 wide, and the graph fills only a small part of the canvas.
4. **Expanded cards are inconsistent and crowded.**
   - Notify's right edge (x≈1652) nearly touches the canvas border (x≈1670), and Schedule's left edge is about 18px from its border.
   - AI Agent drops the glyph tile and puts the icon inline.
   - The cards have different heights, and AI Agent has a dead gap between its quote and its footer.
5. **The "Done" pill uses a "–" glyph.** A minus or dash reads as disabled or skipped, not completed.

## Next

Remove or hairline the success bars, then re-capture with a failed, a waiting and a running node. That is the only way to verify the FAILED-loudest claim, which is the point of the redesign.