import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentProfilePicker, type AgentProfilePickerProps } from "./agent-profile-picker";

const profiles = [
  { id: "studio", name: "Studio", builtin: true },
  { id: "custom", name: "My agent", instructions: "Original instructions", capabilities: ["files"] },
];
const capabilities = [{ id: "files", label: "Files" }, { id: "tools", label: "Tools" }];
const base: AgentProfilePickerProps = { value: "studio", profiles, capabilities, onChange: () => {} };
const nameField = () => screen.getByPlaceholderText("Agent name (e.g. Tax Reviewer)");
const instructionsField = () => screen.getByPlaceholderText(/Instructions \(optional\)/);

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function createDraft(name = "Draft agent") {
  await userEvent.click(screen.getByRole("button", { name: "Agent profile" }));
  await userEvent.click(screen.getByRole("button", { name: /New agent/ }));
  await userEvent.type(nameField(), name);
  await userEvent.type(instructionsField(), "Keep these instructions");
}

describe("AgentProfilePicker inline save lifecycle", () => {
  it("preserves synchronous callbacks and closes only after success", async () => {
    const onCreate = vi.fn();
    render(<AgentProfilePicker {...base} onCreate={onCreate} />);
    await createDraft();
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    expect(onCreate).toHaveBeenCalledWith({ id: undefined, name: "Draft agent", instructions: "Keep these instructions", capabilities: ["files", "tools"] });
    expect(screen.queryByPlaceholderText(/Agent name/)).toBeNull();
    expect(screen.getByTestId("agent-profile-popover")).toBeInTheDocument();
  });

  it("locks duplicate submissions, fields and dismissal while the write is pending", async () => {
    const write = deferred();
    const onCreate = vi.fn(() => write.promise);
    render(<AgentProfilePicker {...base} onCreate={onCreate} />);
    await createDraft();
    const save = screen.getByRole("button", { name: "Save agent" });
    act(() => { fireEvent.click(save); fireEvent.click(save); });
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving agent…" })).toBeDisabled();
    expect(nameField()).toBeDisabled();
    expect(instructionsField()).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Files" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agent profile" })).toBeDisabled();
    expect(nameField().parentElement).toHaveAttribute("aria-busy", "true");
    await userEvent.click(document.body);
    expect(nameField()).toHaveValue("Draft agent");
    await act(async () => write.resolve());
    expect(screen.queryByPlaceholderText(/Agent name/)).toBeNull();
  });

  it.each([new Error("Revision changed"), "offline"])("retains a rejected create and lets the same draft retry: %s", async (reason) => {
    const write = deferred();
    const onCreate = vi.fn().mockImplementationOnce(() => write.promise).mockResolvedValueOnce(undefined);
    render(<AgentProfilePicker {...base} onCreate={onCreate} />);
    await createDraft();
    await userEvent.click(screen.getByRole("checkbox", { name: "Tools" }));
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    await act(async () => write.reject(reason));
    expect(screen.getByRole("alert")).toHaveTextContent(reason instanceof Error ? reason.message : "Your draft is still here; try again.");
    expect(nameField()).toHaveValue("Draft agent");
    expect(instructionsField()).toHaveValue("Keep these instructions");
    expect(screen.getByRole("checkbox", { name: "Tools" })).not.toBeChecked();
    expect(nameField()).not.toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(onCreate.mock.calls[1]).toEqual(onCreate.mock.calls[0]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByPlaceholderText(/Agent name/)).toBeNull();
  });

  it("catches a synchronous throw and retains an update's id and draft on retry", async () => {
    const onUpdate = vi.fn().mockImplementationOnce(() => { throw new Error("Update unavailable"); }).mockResolvedValueOnce(undefined);
    render(<AgentProfilePicker {...base} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole("button", { name: "Agent profile" }));
    await userEvent.click(screen.getByTitle("Edit"));
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Renamed agent");
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Update unavailable");
    expect(nameField()).toHaveValue("Renamed agent");
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[0]).toEqual(["custom", { id: "custom", name: "Renamed agent", instructions: "Original instructions", capabilities: ["files"] }]);
    expect(onUpdate.mock.calls[1]).toEqual(onUpdate.mock.calls[0]);
    expect(screen.queryByPlaceholderText(/Agent name/)).toBeNull();
  });

  it.each([
    ["resolve", "disabled"], ["reject", "disabled"],
    ["resolve", "locked"], ["reject", "locked"],
  ] as const)("ignores an old save's %s after the host sets %s", async (settlement, lock) => {
    const oldWrite = deferred();
    const newWrite = deferred();
    const onCreate = vi.fn().mockReturnValueOnce(oldWrite.promise).mockReturnValueOnce(newWrite.promise);
    const view = render(<AgentProfilePicker {...base} onCreate={onCreate} />);
    await createDraft("Old draft");
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    view.rerender(<AgentProfilePicker {...base} onCreate={onCreate} {...{ [lock]: true }} />);
    expect(screen.queryByTestId("agent-profile-popover")).toBeNull();
    view.rerender(<AgentProfilePicker {...base} onCreate={onCreate} />);
    await createDraft("New draft");
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    await act(async () => { if (settlement === "resolve") oldWrite.resolve(); else oldWrite.reject(new Error("Old failure")); });
    expect(nameField()).toHaveValue("New draft");
    expect(screen.getByRole("button", { name: "Saving agent…" })).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => newWrite.reject(new Error("Current failure")));
    expect(screen.getByRole("alert")).toHaveTextContent("Current failure");
    expect(nameField()).not.toBeDisabled();
  });

  it.each(["resolve", "reject"] as const)("ignores a late %s after unmount without affecting a fresh picker", async (settlement) => {
    const oldWrite = deferred();
    const oldView = render(<AgentProfilePicker {...base} onCreate={() => oldWrite.promise} />);
    await createDraft("Old draft");
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    oldView.unmount();
    render(<AgentProfilePicker {...base} onCreate={() => {}} />);
    await createDraft("Fresh draft");
    await act(async () => { if (settlement === "resolve") oldWrite.resolve(); else oldWrite.reject(new Error("Old failure")); });
    expect(nameField()).toHaveValue("Fresh draft");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Save agent" })).toBeEnabled();
  });

  it("offers only the writes the host supports", async () => {
    const view = render(<AgentProfilePicker {...base} onUpdate={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Agent profile" }));
    expect(screen.queryByRole("button", { name: /New agent/ })).toBeNull();
    expect(screen.getByTitle("Edit")).toBeInTheDocument();
    view.rerender(<AgentProfilePicker {...base} onCreate={() => {}} />);
    expect(screen.getByRole("button", { name: /New agent/ })).toBeInTheDocument();
    expect(screen.queryByTitle("Edit")).toBeNull();
  });

  it("does not claim success if the host removes the callback from an open form", async () => {
    const view = render(<AgentProfilePicker {...base} onCreate={() => {}} />);
    await createDraft();
    view.rerender(<AgentProfilePicker {...base} onUpdate={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save agent" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Creating an agent is unavailable.");
    expect(nameField()).toHaveValue("Draft agent");
  });
});
