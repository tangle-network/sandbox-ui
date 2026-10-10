**Verified:** all three fixes landed. The failed-is-loudest claim only half holds.

- **Success footer bars:** now a muted gray track on the AI Agent and Notify cards, not full-width green.
- **Done pill:** it has a real check in a quiet muted pill, on every card.
- **Borders and kind:** resting borders are neutral and visible. Kind shows as a top rule: indigo on Schedule and AI Agent, blue on Notify.
- **Failed vs. waiting:** failed has a pink border, a red pill, red error text and a pink footer rule. But waiting has an amber border, amber glow, amber pill, amber progress bar and amber inbound arrow. Amber is brighter than the salmon pink, so at a glance Waiting on you pulls the eye as hard as Failed, or harder. The two are at parity, not a clear hierarchy.

| | Last | Now | Pixel evidence |
|---|---|---|---|
| A | 7 | 8 | Done state is calm and kind is legible. |
| B | 4 | 6 | The success bars no longer shout. Failed and waiting are near-equal in loudness. |
| C | 8 | 8 | Unchanged. |
| D | 6 | 7 | Check pill and top rule are clean. In the expanded cards, the right-most card sits about 15px from the canvas edge. |
| Topology | 7 | 8 | The parallel fan-out and fan-in, the ×2 badge and the arrows read clearly. |
| Misconfig | 2 | 2 | No capture shows an invalid or unconfigured node. |
| Trust | 5 | 6 | Output and error blocks help. The GitHub card's output shows a stray "–" line. |
| Find-stuck | 5 | 6 | Works in the expanded cards. Compact mode shows no status at all. |
| Cost | 3 | 4 | Cost shows only as a small muted footer on the AI Agent card. There is no run total. |

You didn't give me a definition for E, so I scored A–D and your five named dimensions.

Wave 1 landed. The expanded view now has a quiet success state and a visible hierarchy, and the remaining gap is state in the compact view. Both compact captures (mixed, linear) show every node as a neutral icon tile with no status, even under "Live: latest run". A stuck or failed node is invisible there, and that is where a many-node graph gets read. The single highest-value change is a status mark on the compact tile: a small ring or corner dot in the same state colors, loudest for failed. While there, drop the amber glow on waiting so failed stays the strongest signal.

Next: add a status ring to the compact tiles.