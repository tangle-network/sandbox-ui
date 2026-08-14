/**
 * `BackendSelector` is the only surface here built directly on
 * `@radix-ui/react-select`, and it had no coverage — so a Radix bump could
 * change how the listbox opens, how a choice is committed, or where focus
 * lands, and nothing would notice.
 *
 * These drive the component the way a person does: open the trigger, pick a
 * row, and check the selection is reported once with the right value. They
 * assert the contract rather than Radix's markup, so a future release is free
 * to restructure the popup internals without failing here.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackendSelector, type Backend } from "./backend-selector";

const backends: Backend[] = [
  { type: "docker", label: "Docker", description: "Containers on a shared host" },
  { type: "firecracker", label: "Firecracker", description: "Micro VMs" },
];

function renderSelector(props: Partial<React.ComponentProps<typeof BackendSelector>> = {}) {
  const onChange = vi.fn();
  render(
    <BackendSelector backends={backends} selected="docker" onChange={onChange} {...props} />,
  );
  return { onChange };
}

describe("BackendSelector", () => {
  it("shows the selected backend on the closed trigger", () => {
    renderSelector();
    expect(screen.getByRole("combobox")).toHaveTextContent("Docker");
  });

  it("opens the listbox and reports the backend that was chosen", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { onChange } = renderSelector();

    await user.click(screen.getByRole("combobox"));
    const listbox = await screen.findByRole("listbox");
    await user.click(within(listbox).getByText("Firecracker"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("firecracker");
  });

  it("does not report a change when the open listbox is dismissed", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { onChange } = renderSelector();

    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("falls back to the placeholder when the selection matches no backend", () => {
    renderSelector({ selected: "gone", placeholder: "Select a model" });
    expect(screen.getByRole("combobox")).toHaveTextContent("Select a model");
  });
});
