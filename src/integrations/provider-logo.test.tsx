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
  it("derives a simpleicons URL for a plain slug", () => {
    expect(providerLogoCandidates({ id: "github" })).toEqual([
      "https://cdn.simpleicons.org/github",
    ]);
  });

  it("maps a curated compound brand to its simpleicons slug", () => {
    expect(providerLogoCandidates({ id: "google-sheets" })[0]).toBe(
      "https://cdn.simpleicons.org/googlesheets",
    );
  });

  it("tries an explicit iconUrl before the derived slugs", () => {
    const out = providerLogoCandidates({
      id: "github",
      iconUrl: "https://example.test/gh.png",
    });
    expect(out[0]).toBe("https://example.test/gh.png");
    expect(out).toContain("https://cdn.simpleicons.org/github");
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
      "https://cdn.simpleicons.org/github",
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
