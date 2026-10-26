import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WorkspaceFilesPane } from "../../workspace/workspace-files-pane";
import { WorkspaceArtifactView } from "../../workspace/workspace-artifact-view";
import { CodeSurface } from "../../workbench/syntax";
import { DiffView } from "../../workbench/diff-view";

const paths = [
  "agents/profiles/router-buyer-progress.md",
  "campaigns/router-reliability/outreach.md",
  "campaigns/router-reliability/README.md",
  "crm/accounts/router-account.md",
  "research/sources/router-product-docs-2026-10-26.md",
  "research/sources/first-customer-brief.md",
  "drafts/",
];

function FilesAndPreview({ initial, className = "h-[560px] w-full max-w-[480px]" }: { initial?: string; className?: string }) {
  const [selected, setSelected] = useState<string | undefined>(initial);
  return (
    <WorkspaceFilesPane
      paths={paths}
      selectedPath={selected}
      onSelect={(path) => { if (!path.endsWith("/") && path.includes(".")) setSelected(path); }}
      onBack={() => setSelected(undefined)}
      expansionKey="storybook:workspace-files"
      preview={selected ? {
        path: selected,
        actions: <a href="#download" className="text-sm text-primary">Download</a>,
        content: <WorkspaceArtifactView hideTitleBlock artifact={{
          id: selected,
          kind: "file",
          title: selected.split("/").pop() ?? selected,
          filename: selected.split("/").pop() ?? selected,
          path: selected,
          mimeType: "text/markdown",
          content: "## Current goal\n\nMake the first routing integration reliable.\n\n- Check current traffic\n- Review latency and error rates\n- Share a focused rollout plan",
        }} />,
      } : undefined}
      className={className}
    />
  );
}

const meta = {
  title: "Workspace/WorkspaceFilesPane",
  component: WorkspaceFilesPane,
  args: { paths },
  parameters: { layout: "padded" },
} satisfies Meta<typeof WorkspaceFilesPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrowseAndPreview: Story = { render: () => <FilesAndPreview /> };
/** From 640 px the tree and the open file sit side by side; drag, arrow keys or double-click the divider. */
export const SplitWithFileOpen: Story = {
  render: () => <FilesAndPreview initial="campaigns/router-reliability/README.md" className="h-[560px] w-full max-w-[1100px]" />,
};
export const Empty: Story = { args: { paths: [], className: "h-[360px] w-full max-w-[480px]" } };
export const EmptyFolder: Story = {
  render: () => <WorkspaceFilesPane root={{ name: "drafts", path: "drafts", type: "directory", children: [] }} className="h-[360px] w-full max-w-[480px]" />,
};

/** Inside a pane that already names the files, such as a companion's Files tab. */
export const InPane: Story = {
  render: () => (
    <div className="flex h-[560px] w-full max-w-[480px] flex-col border border-border bg-background">
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4 text-sm font-medium">Files</div>
      <WorkspaceFilesPane paths={paths} surface="plain" expansionKey="storybook:workspace-files-pane" className="min-h-0 flex-1" />
    </div>
  ),
};

const sources: Record<string, { previous: string; current: string }> = {
  "src/sumcheck/prover.rs": {
    previous: "pub fn prove(poly: &Poly, rounds: usize) -> Proof {\n    let mut transcript = Transcript::new();\n    for round in 0..rounds {\n        let g = poly.round_poly(round);\n        transcript.absorb(&g);\n    }\n    transcript.finish()\n}\n",
    current: "pub fn prove(poly: &Poly, rounds: usize) -> Proof {\n    let mut transcript = Transcript::new();\n    let mut table = poly.evaluations().to_vec();\n    for round in 0..rounds {\n        let g = round_poly_in_place(&mut table, round);\n        transcript.absorb(&g);\n        fold(&mut table, transcript.challenge());\n    }\n    transcript.finish()\n}\n",
  },
  "src/field/kernel.rs": {
    previous: "pub fn mul(a: u64, b: u64) -> u64 {\n    ((a as u128 * b as u128) % P as u128) as u64\n}\n",
    current: "pub fn mul(a: u64, b: u64) -> u64 {\n    montgomery_reduce(a as u128 * b as u128)\n}\n",
  },
  "README.md": { previous: "# Prover\n", current: "# Prover\n\nSum-check prover with in-place folding.\n" },
};

/** The run page's code workspace: tree | editor, tabs for opened files, a diff against the previous release, full screen. */
function EditorFrame() {
  const [selected, setSelected] = useState<string | undefined>("src/sumcheck/prover.rs");
  const source = selected ? sources[selected] : undefined;
  return (
    <WorkspaceFilesPane
      paths={Object.keys(sources)}
      selectedPath={selected}
      onSelect={(path, node) => { if (node?.type === "file") setSelected(path); }}
      onBack={() => setSelected(undefined)}
      label="Code"
      preview={selected && source ? {
        path: selected,
        content: <CodeSurface code={source.current} filename={selected} />,
        compare: { label: "release 41", content: <DiffView filename={selected} baseline={source.previous} current={source.current} /> },
      } : undefined}
      className="h-[70vh] w-full"
    />
  );
}

export const RunEditorFrame: Story = { render: () => <EditorFrame /> };
