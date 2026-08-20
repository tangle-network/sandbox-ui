import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { StatusBanner, type BannerType } from "./status-banner";

/**
 * A status banner is never on screen at first paint. It is mounted when a
 * surface changes state — provisioning finishes, a connection drops, a Hub
 * credential is rejected — which for a screen reader means the text is
 * inserted with nothing to announce it. The role is what makes it heard.
 */
describe("StatusBanner announcement", () => {
  const POLITE: BannerType[] = [
    "provisioning",
    "connecting",
    "warning",
    "success",
    "info",
  ];

  it("announces a failure assertively", () => {
    const { getByRole } = render(
      <StatusBanner type="error" message="The sandbox could not start" />,
    );
    expect(getByRole("alert")).toHaveTextContent("The sandbox could not start");
  });

  it.each(POLITE)("announces %s without interrupting", (type) => {
    const { getByRole } = render(
      <StatusBanner type={type} message="Hub integrations are not attached" />,
    );
    // `alert` is assertive and cuts off whatever is being read. These states
    // are not failures — the surface still works — so they wait their turn.
    expect(getByRole("status")).toHaveTextContent(
      "Hub integrations are not attached",
    );
  });

  it("carries the detail into the announced text", () => {
    // The detail is inside the region, so it is read with the message rather
    // than left for a user who never learns it is there.
    const { getByRole } = render(
      <StatusBanner
        type="warning"
        message="Running with no Hub integrations"
        detail="hub-unauthenticated"
      />,
    );
    expect(getByRole("status")).toHaveTextContent("hub-unauthenticated");
  });

  it("keeps the dismiss control out of the announcement's way", () => {
    const onDismiss = vi.fn();
    const { getByRole } = render(
      <StatusBanner type="warning" message="Degraded" onDismiss={onDismiss} />,
    );
    getByRole("button", { name: "Dismiss" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
