Two caveats first. `vault.png` is the light-theme linear graph, not nested groups. `foreach.png` shows only a For-each node in a line, with no iteration body. So nested groups, guards, cycles and iteration are not covered by these shots, and that is itself a finding. Coordinates below are in the 2000px display space.

**Verdict:** the resting canvas is a tidy icon row. The run canvas is a green wall. Neither answers "what is wrong, and what did it cost?"

## 1. Color hierarchy

| Sev | Finding | Fix |
|---|---|---|
| Blocker | **Kind and state share the same channel (border) and hue family.** The Sandbox kind is green (`mixed.png` ~667,622) and Done is green. The Parallel/For-each kind is amber and Waiting is amber. In a run, a green box could mean "sandbox" or "succeeded". | Kind gets a quiet channel: the icon-tile tint and a 2px top rule. State gets the border, glow and fill. Reserve green, amber and red exclusively for state. Move kinds to hues that don't collide, such as violet, blue, cyan and slate. |
| Blocker | **Success is the loudest signal.** In `succeeded.png` every node carries five greens: 2px border, pill, dot, 4px footer rule and edge. In `anatomy.png` the Failed node (pastel salmon ~1545,647) is no louder than the Done nodes beside it. | Done is quiet: grey border, a 12px check, no pill. Failed is a saturated red, a filled header strip and a halo. Waiting is amber with a pulse. Make the exception the loudest thing on the canvas. |
| Major | **Kind accents are indistinguishable at a glance.** Trigger (Schedule, GitHub), Agent (Builder, AI Agent) and Notify's neighbours all use the same indigo border (~#4a3f8f at ~40% alpha). Only the cyan Notify, amber Parallel and green Sandbox differ. In `linear.png` Schedule and AI Agent are identical except for the glyph. | A kind needs a shape or glyph plus a hue, not a 1.5px low-alpha hairline. Give each of the 4 kinds a distinct tile shape or a header band. |
| Major | **Edges are the brightest chrome at rest.** In `linear.png` they are ~4px light grey (~#bbb), brighter than the node borders and subtitles. | Edges at about 35% luminance, 1.5px. Brighten them only for the active path or on hover. |
| Major | **Brand logos out-shout the kind system.** The white GitHub glyph, orange Anthropic mark and blue DeepSeek whale are the highest-chroma pixels at rest. The agent kind is identified by vendor, not by kind. | Render vendor logos monochrome at 60% in the tile, with the kind glyph as the primary mark. |
| Minor | **Dark-mode depth is weak.** Cards (~#2f2f33) sit on a ~#161616 canvas, inside a ~#333 frame, on a ~#070712 page. That is three greys plus a navy. Card borders disappear. | One canvas surface, one card surface at least 8% lighter, and a 1px inner highlight. |

## 2. Design system organization

There are about 9 one-off systems:

- the resting icon-tile node
- the expanded card
- three pill variants with different glyphs (dot, ×, ▲)
- the ×N badge
- the footer rule
- the mono Output block
- the red Error block
- the pill-style Expand/Compact button, which is not the zoom control
- the square, radius-0 zoom control

Radii run 24, 20, 16, full, 8 and 0, with no pattern.

The 4px full-bleed rule means "done" on the Agent card. On the Gate card (~893–1110,677) the same rule is a half-filled progress bar. One component, two meanings.

**Merge into three primitives:**
- one **Node** with density levels (dot, tile, card)
- one **StatusToken** that sets color, glyph and motion
- one **Meter** for cost and duration

Everything else (output, error, badge, button) becomes a slot or a variant. Put tokens in `--node-surface`, `--state-*`, `--kind-*` and `--edge-*`.

## 3. Reuse and consistency

- **Title and subtitle are rendered three ways.**
  - Resting: centered under the tile, bold 24px.
  - Expanded Schedule and Notify: 44px tile, bold 16px title, grey subtitle.
  - Expanded Agent: a 20px logo and one gray line, "AI Agent · glm-5".
- **Resting says "AI Agent" (kind); expanded says "PR reviewer" (name).** The same node is labelled differently in two modes.
- **Three identical "AI Agent / deepseek-chat" nodes** in `parallel.png` can't be told apart.
- **Node size changes with fit-to-view.** The same tile is 156px (linear), 135px (foreach), 107px (parallel) and 90px (mixed). Label type goes from about 17px to about 10px logical. `anatomy.png` renders footers at about 9px display, which is unreadable.
- **Arrowheads vary.** They are about 18px in linear, 10px in mixed and 8px in anatomy.
- **The Schedule card has no footer or duration** while the other two do, so "Done" carries no timing.
- **Icons mix three styles:** outline stroke (clock, bell, branch), filled vendor logos, and a bare ×N badge.

## 4. Visibility and information hierarchy

- **Where the eye lands, resting:** the white GitHub glyph and the bold white labels, then the thick edges. It lands on decoration.
- **Where it lands, run:** the green outlines.
- **The one correct moment is the amber-glow Gate card in `anatomy.png`.** Everything around it competes with it.
- **Hidden:**
  - There is no per-node cost or duration at rest.
  - There is no run total anywhere. Cost is a 12px grey footer, the lowest-contrast text on the card.
  - Edges have no labels or guard conditions.
  - The failure's downstream blast radius isn't shown.
- **Truncation hits the critical text.** The error reads "…Invite the ap…" and the gate subtitle "approve / reque…" collides with its pill.
- **The Agent card shows the prompt (input), not the output.** There is also a ~60px void above its footer (~813–1187,640–710).
- **Header reads "Live: latest run" with no live dot,** no run id, no elapsed time and no total cost.
- **Parallel carries redundant information:** a "×3" badge clipped at the card corner (~775,570) and "3 branches" in the subtitle.

## 5. Intent scorecard

| Job | Score | What breaks it |
|---|---|---|
| Verify topology | 6 | Linear is fine. Parallel and join buses overlap, with the middle edge running through the merge at ~1135,617. For-each scope is ambiguous: is Notify per item or once? No guards, cycles or groups are shown. |
| Spot misconfiguration | 2 | Nothing shows missing credentials, unmapped inputs, an unbound model or a dead branch. Subtitles are the only config. |
| Trust the run | 4 | The fixture has a Done node (GitHub reviews) downstream of a Waiting gate, which contradicts a blocking gate. There is no failure propagation. Edges are coloured by target state, not by data that actually flowed. |
| Find the stuck node in <3s | 5 | The amber glow works. Resting shots have no state signal at all. At fit-zoom the pills are unreadable. |
| Know the cost | 2 | Per-node cost is 12px grey, there is no total, and non-LLM nodes show no cost. |

## 6. Layout and space

- **Dead space.** In `anatomy.png` the graph is a ~130px band inside a 750px canvas, about 85% empty. Linear fills about 30%. Fit-view centers the graph but doesn't scale up to the space available.
- **Cards touch the edges.** In `succeeded.png` Notify's right edge is at 1652 against a canvas edge of 1670, and Schedule starts at 347 against 330. Fit padding is about 17px.
- **Tile in a tile.** The tile is 156px and its inner icon plate is 96px. That is about 30px of dead padding per side, spent on a nested square that adds nothing.
- **Chrome.** Expand and Compact sit on top of the canvas, and a 36px zoom column is bottom-right. The header strip burns about 70px for "Graph" and "Live".
- **Fan-out.** Elbows are clean and rounded. But the join has no semantics (all, any, race), and branch labels sit at 11px under 90px tiles.
- **Light theme** (`vault.png`) works better than dark: white cards on a grey canvas give real separation. Dark needs to match that contrast.

## 7. The 100x: top 10 by impact

1. **Separate state from kind** (S–M). Kind goes to tile tint and a top rule. State owns border, fill, glow and motion. This fixes the Blocker color collisions.
2. **Invert emphasis** (S). Done is quiet. Running is animated. Waiting is amber with a pulse. Failed is saturated red with a header fill. Stuck-in-3s becomes automatic.
3. **Semantic zoom with a readable floor** (M). Three densities: dot, tile, card. Never render text under 11px. Zoom or LOD changes density, not just scale. This fixes size drift and the 9px footers.
4. **Cost and time as first-class** (M). Show a run-total strip with cost, elapsed and failed and waiting counts. Add a per-node cost badge at all densities. Add a heatmap toggle that shades nodes by cost or duration.
5. **Failure and blocked propagation** (M). Downstream nodes of a failed or waiting node go to a "blocked" hatched state. The stalled edge dashes. Click the failure to jump to its error. Never truncate the error head.
6. **Edge semantics** (M). Add guard-condition chips on edges. Show flowing data by animating the active edge. Draw cycles distinctly. Differentiate edge types by style and not just color. Quiet the default edge.
7. **Unified node anatomy** (M). One header: tile, user-given name, kind and model line, status token. Expanded cards show output (not input), then a cost and duration meter. Drop the redundant ×N badge and pill-plus-border-plus-bar.
8. **Structure as containers** (M–L). Render Parallel, For-each and groups as labelled containers or swimlanes around their body. A join shows all or any. Iteration shows "item 3 of 12" with a collapsible stack. This fixes the ambiguity in `foreach.png`.
9. **Misconfiguration lint overlay** (L). Show a red dot on a node for a missing credential, unmapped input or dead branch. List the problems in a side count so a builder sees errors before running.
10. **Token cleanup** (S–M). Radius scale, one shadow scale, 3 surfaces, edge tokens, and one Meter. Make vendor logos monochrome. Remove the nested tile. Fix canvas padding and fit-to-content scale.

## The redesign in one breath

Stop painting every node in kind colors and borders. Make kind a quiet glyph and tint, make state the only loud channel (quiet green, loud red, pulsing amber), and make it semantic-zoom so labels stay readable. Put cost, time and failure blast radius on the canvas and the run header, label edges with their guards, draw loops and parallel steps as containers, and show misconfiguration before the run starts. The test is that a builder sees what is wrong and what it costs in under 3 seconds without opening a node.

Next: I can write the token spec for items 1, 2 and 10, since those unblock the rest.