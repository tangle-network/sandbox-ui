import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WorkspaceFilesPane } from "../../workspace/workspace-files-pane";
import { WorkspaceArtifactView } from "../../workspace/workspace-artifact-view";

const paths = [
  "agents/profiles/router-buyer-progress.md",
  "campaigns/router-reliability/outreach.md",
  "campaigns/router-reliability/README.md",
  "crm/accounts/router-account.md",
  "research/sources/router-product-docs.md",
  "research/sources/first-customer-brief.md",
  "drafts/",
];

function FilesAndPreview() {
  const [selected, setSelected] = useState<string>();
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
      className="h-[560px] w-full max-w-[480px] border border-border"
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
export const Empty: Story = { args: { paths: [], className: "h-[360px] w-full max-w-[480px]" } };
export const EmptyFolder: Story = {
  render: () => <WorkspaceFilesPane root={{ name: "drafts", path: "drafts", type: "directory", children: [] }} className="h-[360px] w-full max-w-[480px]" />,
};
