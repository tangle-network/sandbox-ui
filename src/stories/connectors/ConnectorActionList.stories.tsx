import type { Meta, StoryObj } from "@storybook/react";
import { ConnectorActionList } from "../../connectors/action-list";
import type { ConnectorAction } from "../../connectors/types";

const githubActions: ConnectorAction[] = [
  {
    path: "github.issues.create",
    title: "GitHub: Create issue",
    description: "Open a new issue on a repository.",
    risk: "write",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner login" },
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Markdown issue body" },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to apply on creation",
        },
      },
      required: ["owner", "repo", "title"],
    },
    outputSchema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "The new issue number" },
        url: { type: "string" },
      },
    },
  },
  {
    path: "github.pulls.reviews.create",
    title: "GitHub: Create pull request review",
    description: "Submit a review verdict on a pull request.",
    risk: "write",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pull_number: { type: "integer" },
        event: {
          type: "string",
          enum: ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
          description: "The review verdict",
        },
        body: { type: "string" },
      },
      required: ["owner", "repo", "pull_number", "event"],
    },
  },
  {
    path: "github.issues.list",
    title: "GitHub: List issues",
    description: "List issues for a repository, filtered by state and labels.",
    risk: "read",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"] },
        assignee: {
          type: "object",
          description: "Filter by assignee",
          properties: {
            login: { type: "string" },
            type: { type: "string", enum: ["User", "Bot"] },
          },
        },
      },
      required: ["owner", "repo"],
    },
  },
  {
    path: "github.repos.delete",
    title: "GitHub: Delete repository",
    description: "Permanently delete a repository. This cannot be undone.",
    risk: "destructive",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    // No title / no risk — falls back to the path and an "unclassified" badge.
    path: "github.meta.ping",
    description: "Check connectivity to the GitHub API.",
  },
];

const meta: Meta<typeof ConnectorActionList> = {
  title: "Connectors/ConnectorActionList",
  component: ConnectorActionList,
  parameters: { layout: "padded", backgrounds: { default: "dark" } },
  args: {
    providerTitle: "GitHub",
    actions: githubActions,
    onBuildWithAssistant: (action) =>
      console.log("build with assistant", action.path),
  },
};

export default meta;
type Story = StoryObj<typeof ConnectorActionList>;

export const Default: Story = {
  name: "Default",
  render: (args) => (
    <div className="w-[760px]">
      <ConnectorActionList {...args} />
    </div>
  ),
};

export const Truncated: Story = {
  name: "Truncated (N+)",
  render: (args) => (
    <div className="w-[760px]">
      <ConnectorActionList {...args} />
    </div>
  ),
  args: { maybeTruncated: true },
};

export const WithoutAssistant: Story = {
  name: "Without assistant button",
  render: (args) => (
    <div className="w-[760px]">
      <ConnectorActionList {...args} />
    </div>
  ),
  args: { onBuildWithAssistant: undefined },
};

export const Empty: Story = {
  name: "No actions",
  render: (args) => (
    <div className="w-[760px]">
      <ConnectorActionList {...args} />
    </div>
  ),
  args: { actions: [] },
};
