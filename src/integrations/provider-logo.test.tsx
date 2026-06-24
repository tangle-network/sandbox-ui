// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  normalizeProviderId,
  ProviderIcon,
  providerLogoCandidates,
} from "./provider-logo";

afterEach(cleanup);

describe("normalizeProviderId", () => {
  it("lowercases, separates, and strips common suffixes", () => {
    expect(normalizeProviderId("Outlook-Mail")).toBe("outlook");
    expect(normalizeProviderId("stripe_pack")).toBe("stripe");
    expect(normalizeProviderId("Google Sheets")).toBe("google-sheets");
  });
});

describe("providerLogoCandidates", () => {
  it("resolves the ActivePieces CDN by id, then a simpleicons slug", () => {
    expect(providerLogoCandidates({ id: "github" })).toEqual([
      "https://cdn.activepieces.com/pieces/github.png",
      "https://cdn.simpleicons.org/github",
    ]);
  });

  it("puts the ActivePieces CDN first for a long-tail provider", () => {
    expect(providerLogoCandidates({ id: "attio" })[0]).toBe(
      "https://cdn.activepieces.com/pieces/attio.png",
    );
  });

  it("uses a pinned override before the default ActivePieces path", () => {
    const out = providerLogoCandidates({ id: "anthropic" });
    expect(out[0]).toBe("https://cdn.activepieces.com/pieces/claude.png");
    // The default `/anthropic.png` path still follows as a candidate.
    expect(out).toContain("https://cdn.activepieces.com/pieces/anthropic.png");
  });

  it("keeps the curated simpleicons slug as a fallback after the CDN", () => {
    const out = providerLogoCandidates({ id: "google-sheets" });
    expect(out[0]).toBe(
      "https://cdn.activepieces.com/pieces/google-sheets.png",
    );
    expect(out).toContain("https://cdn.simpleicons.org/googlesheets");
  });

  it("tries an explicit iconUrl before everything else", () => {
    const out = providerLogoCandidates({
      id: "github",
      iconUrl: "https://example.test/gh.png",
    });
    expect(out[0]).toBe("https://example.test/gh.png");
    expect(out).toContain("https://cdn.activepieces.com/pieces/github.png");
  });

  it("yields no candidates for an empty id (drives the monogram fallback)", () => {
    expect(providerLogoCandidates({ id: "" })).toEqual([]);
  });
});

describe("ProviderIcon", () => {
  it("renders the resolved logo image for a known provider", () => {
    const { container } = render(<ProviderIcon id="github" size={16} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(
      "https://cdn.activepieces.com/pieces/github.png",
    );
  });

  it("falls back to a monogram tile when no logo can resolve", () => {
    const { container } = render(
      <ProviderIcon id="" displayName="Zapier" size={16} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("Z");
  });

  it("resets the candidate cursor when iconUrl changes for the same id", () => {
    const { container, rerender } = render(
      <ProviderIcon id="acme" iconUrl="https://a.test/old.png" size={16} />,
    );
    const first = container.querySelector("img");
    expect(first?.getAttribute("src")).toBe("https://a.test/old.png");
    // The explicit icon fails to load → cursor advances off it.
    fireEvent.error(first as HTMLImageElement);
    expect(container.querySelector("img")?.getAttribute("src")).not.toBe(
      "https://a.test/old.png",
    );
    // A new iconUrl for the SAME id must reset the cursor and be tried first —
    // not stay stranded on the prior, exhausted chain.
    rerender(
      <ProviderIcon id="acme" iconUrl="https://a.test/new.png" size={16} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://a.test/new.png",
    );
  });
});
