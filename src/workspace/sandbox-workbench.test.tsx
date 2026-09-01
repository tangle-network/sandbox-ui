import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { GitCompare } from "lucide-react";
import { SandboxWorkbench, type SandboxWorkbenchArtifact } from "./sandbox-workbench";

function mockDesktop(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  mockDesktop(true);
});

const session = { messages: [], partMap: {}, isStreaming: false };

describe("SandboxWorkbench — composer slot", () => {
  it("renders the composer under the transcript in the transcript's max-w-3xl column", () => {
    const { getByTestId, getByText } = render(
      <SandboxWorkbench session={session} composer={<div data-testid="composer">Composer</div>} />,
    );
    const column = getByTestId("composer").parentElement as HTMLElement;
    expect(column.className).toBe("mx-auto w-full max-w-3xl px-3 pb-3");
    const band = column.parentElement as HTMLElement;
    expect(band.className).toBe("shrink-0");
    expect(band.className).not.toMatch(/border-t/);
    // The slot follows the transcript inside the same column wrapper.
    const transcript = getByText("Start a conversation.");
    expect(transcript.compareDocumentPosition(getByTestId("composer")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps composerControls above the composer when both are given", () => {
    const { getByTestId } = render(
      <SandboxWorkbench
        session={{ ...session, composerControls: <div data-testid="controls">Controls</div> }}
        composer={<div data-testid="composer">Composer</div>}
      />,
    );
    const controls = getByTestId("controls");
    const composer = getByTestId("composer");
    expect(controls.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((controls.parentElement as HTMLElement).className).toMatch(/border-t/);
  });
});

describe("SandboxWorkbench — centerHeader", () => {
  it("keeps the branded card and the framed transcript by default", () => {
    const { getByText } = render(<SandboxWorkbench title="Tax filing" session={session} />);
    expect(getByText("Tangle Sandbox")).toBeInTheDocument();
    expect(getByText("Tax filing")).toBeInTheDocument();
    expect(getByText("Execution timeline")).toBeInTheDocument();
  });

  it("null hides the card and renders the transcript directly on bg-surface", () => {
    const { queryByText, getByText } = render(
      <SandboxWorkbench title="Tax filing" session={session} centerHeader={null} />,
    );
    expect(queryByText("Tangle Sandbox")).toBeNull();
    expect(queryByText("Tax filing")).toBeNull();
    expect(queryByText("Execution timeline")).toBeNull();
    expect(queryByText("Agent Session")).toBeNull();
    const transcript = getByText("Start a conversation.");
    const column = transcript.closest("div.bg-surface") as HTMLElement;
    expect(column).not.toBeNull();
    expect(column.className).toBe("flex h-full min-h-0 flex-col bg-surface");
    // No ArtifactPane frame between the center slot and the transcript column.
    expect(column.closest("section")).toBeNull();
  });

  it("null also drops the shell's empty center header row until a pane closes", () => {
    const { getByText, getByLabelText } = render(
      <SandboxWorkbench
        session={session}
        centerHeader={null}
        rail={<div>Rail</div>}
        artifacts={[{ id: "notes", kind: "markdown", title: "Notes", content: "# Notes" }]}
        layout={{ resizable: false }}
      />,
    );
    const main = getByText("Start a conversation.").closest("main") as HTMLElement;
    expect(main.querySelector("div.h-14")).toBeNull();
    fireEvent.click(getByLabelText("Collapse right panel"));
    expect(getByLabelText("Open right panel").closest("div.h-14")).not.toBeNull();
  });

  it("a node replaces the card", () => {
    const { queryByText, getByText } = render(
      <SandboxWorkbench session={session} centerHeader={<span>Session title</span>} />,
    );
    expect(getByText("Session title")).toBeInTheDocument();
    expect(queryByText("Tangle Sandbox")).toBeNull();
    // The framed transcript is unchanged; only the card above it moved.
    expect(getByText("Execution timeline")).toBeInTheDocument();
  });
});

describe("SandboxWorkbench — rail", () => {
  it("is the first left section, ahead of the directory pane", () => {
    const { getByTestId, getByLabelText } = render(
      <SandboxWorkbench
        session={session}
        rail={<div data-testid="rail">Rail</div>}
        directory={{ root: { name: "agent", path: "/home/agent", type: "directory", children: [] } }}
      />,
    );
    const left = getByLabelText("Left workspace panel");
    expect(left.contains(getByTestId("rail"))).toBe(true);
    const sections = left.querySelector("div.min-h-0.flex-1.overflow-auto > div") as HTMLElement;
    expect(sections.firstElementChild?.contains(getByTestId("rail"))).toBe(true);
  });

  it("fills the pane with no region header and no gutter when it is the only left section", () => {
    const { getByTestId, getByLabelText, queryByText, queryByLabelText } = render(
      <SandboxWorkbench session={session} rail={<div data-testid="rail">Rail</div>} />,
    );
    const left = getByLabelText("Left workspace panel");
    expect(queryByText("Workspace Panels")).toBeNull();
    expect(queryByLabelText("Collapse left panel")).toBeNull();
    const wrapper = getByTestId("rail").parentElement as HTMLElement;
    expect(wrapper.parentElement).toBe(left);
    expect(wrapper.className).toMatch(/\bpy-0\b/);
    expect(wrapper.className).not.toMatch(/\bpy-1\b/);
  });

  it("forwards controlled pane state and shortcuts through layout", () => {
    const onLeftOpenChange = vi.fn();
    const { getByText, queryByLabelText } = render(
      <SandboxWorkbench
        session={session}
        rail={<div>Rail</div>}
        layout={{
          leftOpen: false,
          onLeftOpenChange,
          keyboardShortcuts: true,
          // The control is the consumer's: it reports through the same callback.
          leftCollapsedControl: (
            <button type="button" onClick={() => onLeftOpenChange(true)}>
              Show chats
            </button>
          ),
        }}
      />,
    );
    expect(queryByLabelText("Left workspace panel")).toBeNull();
    fireEvent.click(getByText("Show chats"));
    expect(onLeftOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(onLeftOpenChange).toHaveBeenCalledTimes(2);
  });
});

describe("SandboxWorkbench — artifact tabs", () => {
  const artifacts: SandboxWorkbenchArtifact[] = [
    { id: "notes", kind: "markdown", title: "Notes", content: "# Notes" },
    { id: "changes", kind: "custom", title: "Changes", icon: GitCompare, pinned: true, content: <div>3 files</div> },
  ];

  it("sorts a pinned artifact first, gives it no close button, and uses its own icon", () => {
    const onArtifactClose = vi.fn();
    const { getAllByRole, queryByLabelText, getByLabelText, container } = render(
      <SandboxWorkbench session={session} artifacts={artifacts} onArtifactClose={onArtifactClose} />,
    );
    const tabs = getAllByRole("button", { name: /^(Changes|Notes)$/ });
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Changes", "Notes"]);
    expect(queryByLabelText("Close Changes")).toBeNull();
    expect(getByLabelText("Close Notes")).toBeInTheDocument();
    expect(tabs[0]?.querySelector("svg.lucide-git-compare")).not.toBeNull();
    // The pinned tab is the default selection, so its content shows first.
    expect(container.textContent).toContain("3 files");
  });

  it("keeps the given order and every close button when nothing is pinned", () => {
    const { getAllByRole, getByLabelText } = render(
      <SandboxWorkbench
        session={session}
        artifacts={artifacts.map((artifact) => ({ ...artifact, pinned: false }))}
        onArtifactClose={() => {}}
      />,
    );
    const tabs = getAllByRole("button", { name: /^(Changes|Notes)$/ });
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Notes", "Changes"]);
    expect(getByLabelText("Close Changes")).toBeInTheDocument();
  });
});
