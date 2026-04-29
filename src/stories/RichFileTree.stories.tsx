import type { Meta, StoryObj } from "@storybook/react";
import { RichFileTree, type RichFileTreeGitEntry } from "../files/rich-file-tree";
import type { FileNode } from "../files/file-tree";

const meta: Meta<typeof RichFileTree> = {
  title: "Files/RichFileTree",
  component: RichFileTree,
  parameters: { layout: "padded", backgrounds: { default: "dark" } },
  decorators: [
    (Story) => (
      <div className="w-[420px] h-[480px] rounded-xl border border-border bg-card overflow-hidden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RichFileTree>;

const sampleRoot: FileNode = {
  name: "vault",
  path: "",
  type: "directory",
  children: [
    {
      name: "personas",
      path: "personas",
      type: "directory",
      children: [
        { name: "domain-saas-founder.md", path: "personas/domain-saas-founder.md", type: "file" },
        { name: "regression-paranoid-shipper.md", path: "personas/regression-paranoid-shipper.md", type: "file" },
        { name: "skeptical-agent-builder.md", path: "personas/skeptical-agent-builder.md", type: "file" },
      ],
    },
    {
      name: "signals",
      path: "signals",
      type: "directory",
      children: [
        {
          name: "2026-04-28",
          path: "signals/2026-04-28",
          type: "directory",
          children: [
            { name: "router-pricing.md", path: "signals/2026-04-28/router-pricing.md", type: "file" },
            { name: "competitor-launch.md", path: "signals/2026-04-28/competitor-launch.md", type: "file" },
          ],
        },
      ],
    },
    { name: "brief.md", path: "brief.md", type: "file" },
    { name: "README.md", path: "README.md", type: "file" },
  ],
};

const flatPaths = [
  "README.md",
  "brief.md",
  "personas/domain-saas-founder.md",
  "personas/regression-paranoid-shipper.md",
  "personas/skeptical-agent-builder.md",
  "signals/2026-04-28/router-pricing.md",
  "signals/2026-04-28/competitor-launch.md",
]

export const Default: Story = {
  name: "Default (paths input)",
  args: { paths: flatPaths, search: true },
};

export const FromTreeNode: Story = {
  name: "From recursive FileNode",
  args: { root: sampleRoot, search: true },
};

export const WithGitStatus: Story = {
  name: "With git-status overlays",
  args: {
    paths: flatPaths,
    gitStatus: [
      { path: "brief.md", status: "modified" },
      { path: "signals/2026-04-28/router-pricing.md", status: "added" },
      { path: "personas/skeptical-agent-builder.md", status: "modified" },
    ] as RichFileTreeGitEntry[],
    search: true,
  },
};

export const NoSearch: Story = {
  name: "Without search input",
  args: { paths: flatPaths, search: false },
};

export const HugeTree: Story = {
  name: "Huge (5000 files — virtualization smoke test)",
  args: {
    paths: Array.from({ length: 5000 }, (_, i) => {
      const dir = `dir-${Math.floor(i / 50)}`;
      return `${dir}/file-${i}.md`;
    }),
    search: true,
  },
};
