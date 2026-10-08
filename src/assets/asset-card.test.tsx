/**
 * An Asset Studio card opens its asset: the thumbnail and body are one click
 * target, the review buttons keep their own actions, and the queue reports
 * the ids it shows so a detail view can step through them.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AssetCard } from "./asset-card";
import { ApprovalQueue } from "./approval-queue";
import type { AssetSpec } from "./types";

const brand = {
  primaryColor: "#111111",
  accentColor: "#222222",
  textColor: "#ffffff",
  fontFamily: "Inter",
  businessName: "Acme",
  voice: "plain"
};

function asset(id: string, overrides: Partial<AssetSpec> = {}): AssetSpec {
  return {
    id,
    workspaceId: "w",
    format: "image:feed",
    brand,
    content: { slides: [{ background: { type: "image", url: `/files/${id}.png` }, layers: [] }] },
    status: "pending_review",
    createdAt: "2026-10-08T12:00:00.000Z",
    updatedAt: "2026-10-08T12:00:00.000Z",
    ...overrides
  } as AssetSpec;
}

const video = asset("reel", {
  format: "video:reel",
  content: {
    durationSeconds: 18,
    scenes: [{ type: "image-reveal", durationSeconds: 18, imageUrl: "/files/poster.jpg" }],
    renderedUrl: "/files/reel.mp4"
  }
});

afterEach(cleanup);

describe("AssetCard", () => {
  it("opens the asset from its thumbnail and keeps review buttons separate", () => {
    const onOpen = vi.fn();
    const onApprove = vi.fn();
    render(createElement(AssetCard, { spec: asset("ad"), onOpen, onApprove, onReject: vi.fn() }));

    const open = screen.getByRole("button", { name: "Open feed image, pending review" });
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledWith("ad");

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith("ad");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows the image itself and a video's poster frame with its length", () => {
    const { container } = render(createElement("div", null,
      createElement(AssetCard, { spec: asset("ad") }),
      createElement(AssetCard, { spec: video })
    ));
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(sources).toEqual(["/files/ad.png", "/files/poster.jpg"]);
    expect(screen.getByText("0:18")).toBeInTheDocument();
    expect(screen.getByText("Reel")).toBeInTheDocument();
  });

  it("has no open control without onOpen", () => {
    render(createElement(AssetCard, { spec: asset("ad") }));
    expect(screen.queryByRole("button", { name: /^Open/ })).toBeNull();
  });
});

describe("ApprovalQueue", () => {
  it("reports the opened id with the ids the queue shows", () => {
    const onOpen = vi.fn();
    render(createElement(ApprovalQueue, {
      assets: [asset("one"), asset("done", { status: "approved" }), video],
      onOpen
    }));
    fireEvent.click(screen.getByRole("button", { name: "Open reel, pending review" }));
    expect(onOpen).toHaveBeenCalledWith("reel", ["one", "reel"]);
  });
});
