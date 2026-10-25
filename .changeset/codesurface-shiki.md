---
"@tangle-network/sandbox-ui": minor
---

`CodeSurface` and `CodeView` highlight with the Shiki highlighter that `DiffView` already uses (through `@pierre/diffs`), so Rust, TOML, Go, C and C++, Solidity, SQL, shell, Dockerfile and every other Shiki language render highlighted; each grammar loads on first use. `CodeView` adds copy, a wrap toggle and go to line (Ctrl/Cmd+G), and both follow the host's light or dark theme unless `themeType` is set. `react-syntax-highlighter` leaves the package. `BRAND_PRISM_THEME` and `resolveLanguage` are removed (no consumers); `CODE_THEME` names the shared theme.
