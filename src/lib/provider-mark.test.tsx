// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { normalizeBrandKey, ProviderMark } from "./model-brand";

afterEach(cleanup);

describe("ProviderMark", () => {
  it("draws every Studio video maker's mark from its slug", () => {
    for (const [slug, label] of [["bytedance", "ByteDance"], ["kuaishou", "Kling"], ["runway", "Runway"], ["lightricks", "Lightricks"]]) {
      const { container, unmount } = render(<ProviderMark provider={slug} />);
      expect(container.querySelector(`[aria-label="${label}"]`), slug).not.toBeNull();
      unmount();
    }
  });
  it("maps model names to their maker", () => {
    expect(normalizeBrandKey("seedance-1-pro")).toBe("bytedance");
    expect(normalizeBrandKey("ltx-video")).toBe("lightricks");
  });
  it("returns nothing for a maker without a bundled logo", () => {
    expect(render(<ProviderMark provider="acme-labs" />).container.firstChild).toBeNull();
  });
});
