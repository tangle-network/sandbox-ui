export { SandboxArtifactPane } from "./sandbox-artifact-pane"
export type {
  ArtifactView,
  SandboxArtifact,
  SandboxArtifactTerminal,
  SandboxArtifactPaneProps,
} from "./types"

// Composable building blocks — exported for hosts that want to assemble a
// custom workbench from the same parts.
export { PillTabs, type PillTabItem, type PillTabsProps } from "./pill-tabs"
export { PanelHeader, GitStatusBadge, type PanelHeaderProps } from "./panel-header"
export { FileBreadcrumb, type FileBreadcrumbProps } from "./file-breadcrumb"
export { CodeView, type CodeViewProps } from "./code-view"
export { DiffView, type DiffViewProps } from "./diff-view"
export { PreviewView, type PreviewViewProps } from "./preview-view"
export { CodeSurface, resolveLanguage, BRAND_PRISM_THEME, type CodeSurfaceProps } from "./syntax"
export { computeDiffStats, buildUnifiedPatch, type DiffStats } from "./diff-utils"
