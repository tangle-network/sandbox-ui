import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  AgentMessagingConnection,
  type AgentEnrollmentViewState,
  type SharedMessagingRouteViewState,
} from "../../connections";

const routeReady: SharedMessagingRouteViewState = {
  status: "ready",
  channelLabel: "Messages",
  destinationLabel: "Member conversation",
};

const enrolled: AgentEnrollmentViewState = {
  status: "enrolled",
  target: { agentLabel: "Research assistant", workspaceLabel: "Demo workspace" },
};

const meta: Meta<typeof AgentMessagingConnection> = {
  title: "Connections/AgentMessagingConnection",
  component: AgentMessagingConnection,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <main className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-xl">
          <Story />
        </div>
      </main>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentMessagingConnection>;

export const Checking: Story = {
  args: { enrollment: { status: "checking" }, route: { status: "checking" }, onEnroll: () => {} },
};

function EnrollmentFixture() {
  const [enrollment, setEnrollment] = useState<AgentEnrollmentViewState>({ status: "eligible" });
  return (
    <AgentMessagingConnection
      enrollment={enrollment}
      route={routeReady}
      onEnroll={() => setEnrollment({ status: "enrolling" })}
    />
  );
}

export const ReadyToEnroll: Story = { render: () => <EnrollmentFixture /> };

export const Enrolling: Story = {
  args: { enrollment: { status: "enrolling" }, route: routeReady, onEnroll: () => {} },
};

export const Connected: Story = {
  args: { enrollment: enrolled, route: routeReady, onEnroll: () => {} },
};

export const RoutePending: Story = {
  args: { enrollment: enrolled, route: { status: "pending" }, onEnroll: () => {} },
};

export const RouteUnavailable: Story = {
  args: { enrollment: enrolled, route: { status: "unavailable" }, onEnroll: () => {} },
};

export const RouteAccessDenied: Story = {
  args: { enrollment: enrolled, route: { status: "forbidden" }, onEnroll: () => {} },
};

export const AccessDenied: Story = {
  args: { enrollment: { status: "forbidden" }, route: routeReady, onEnroll: () => {} },
};

export const CheckFailed: Story = {
  args: {
    enrollment: { status: "error" },
    route: { status: "error" },
    onEnroll: () => {},
    onRetry: () => {},
  },
};
