/**
 * Email and copy assets read the way their audience meets them: an email
 * shows its sender, subject, inbox line and body on a page its brand colours
 * can be read on; copy shows its channel, headline and body.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { CopyPreview } from "./copy-preview";
import { EmailPreview, emailPalette } from "./email-preview";
import { AssetCard } from "../asset-card";
import type { AssetSpec, EmailContent } from "../types";

const darkBrand = {
  primaryColor: "#6366F1", accentColor: "#6888F9", textColor: "#FDFDFD", fontFamily: "Inter", businessName: "Tangle", voice: "direct"
};
const lightBrand = { ...darkBrand, primaryColor: "#FDE047", textColor: "#111111" };

const email: EmailContent = {
  subject: "Agents need their own computers",
  preheader: "Give every agent an isolated sandbox in one call.",
  sections: [
    { type: "hero", headline: "Run agents in isolated sandboxes", ctaLabel: "Start free", ctaUrl: "https://example.test" },
    { type: "body", text: "Each agent gets a fresh machine." },
    { type: "cta", label: "Read the docs", url: "https://example.test/docs" }
  ]
};

afterEach(cleanup);

describe("emailPalette", () => {
  it("writes light brand text on a dark page and keeps dark text on a light one", () => {
    expect(emailPalette(darkBrand)).toMatchObject({ scheme: "dark", ink: "#FDFDFD", buttonText: "#111111" });
    expect(emailPalette({ ...darkBrand, primaryColor: "#4338CA" }).buttonText).toBe("#ffffff");
    expect(emailPalette(lightBrand)).toMatchObject({ scheme: "light", ink: "#111111", accent: "#111111", buttonText: "#111111" });
  });
});

describe("EmailPreview", () => {
  it("shows the sender, subject, inbox line and the rendered body", () => {
    render(createElement(EmailPreview, { content: email, brand: darkBrand }));
    expect(screen.getByRole("heading", { level: 3, name: email.subject })).toBeInTheDocument();
    expect(screen.getByText(email.preheader!)).toBeInTheDocument();
    expect(screen.getByText("Tangle")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Run agents in isolated sandboxes" })).toBeInTheDocument();
    expect(screen.getByText("Each agent gets a fresh machine.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the docs" })).toBeInTheDocument();
  });
});

describe("CopyPreview", () => {
  it("shows the channel, its length budget, the headline and the body", () => {
    render(createElement(CopyPreview, { content: { platform: "x", headline: "Sandboxes for agents", body: "One call, one machine.", hashtags: ["agents"] } }));
    expect(screen.getByText("X")).toBeInTheDocument();
    expect(screen.getByText("22 / 280 characters")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sandboxes for agents" })).toBeInTheDocument();
    expect(screen.getByText("#agents")).toBeInTheDocument();
  });
});

describe("AssetCard thumbnails", () => {
  const spec = (format: AssetSpec["format"], content: unknown) => ({
    id: format, workspaceId: "w", format, brand: darkBrand, content, status: "pending_review",
    createdAt: "2026-10-08T12:00:00.000Z", updatedAt: "2026-10-08T12:00:00.000Z"
  }) as AssetSpec;

  it("previews an email's sender, subject, inbox line and opening", () => {
    render(createElement(AssetCard, { spec: spec("email", email) }));
    expect(screen.getByText(email.subject)).toBeInTheDocument();
    expect(screen.getByText(email.preheader!)).toBeInTheDocument();
    expect(screen.getByText("Run agents in isolated sandboxes")).toBeInTheDocument();
  });

  it("sets copy as a channel, headline and body", () => {
    render(createElement(AssetCard, { spec: spec("copy:caption", { platform: "linkedin", headline: "Ship it", body: "Body copy" }) }));
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Ship it")).toBeInTheDocument();
    expect(screen.getByText("Body copy")).toBeInTheDocument();
  });
});
