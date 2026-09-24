import { describe, expect, it } from "vitest"
import { previewAccessLabel, previewReadinessLabel, safePreviewUrl } from "./preview-policy"

describe("preview navigation", () => {
  it("allows a relative path on the authorized preview origin", () => {
    expect(safePreviewUrl("/settings", "https://preview.example.test/start", ["https://preview.example.test"])).toBe("https://preview.example.test/settings")
  })
  it.each(["javascript:alert(1)", "data:text/html,hello", "file:///tmp/private", "http://public.example.test/", "https://user:secret@preview.example.test/"])("rejects %s", (url) => {
    expect(() => safePreviewUrl(url)).toThrow()
  })
  it("allows HTTP only for loopback development", () => {
    expect(safePreviewUrl("http://127.0.0.1:3000/")).toBe("http://127.0.0.1:3000/")
    expect(safePreviewUrl("http://localhost:3000/")).toBe("http://localhost:3000/")
    expect(() => safePreviewUrl("http://localhost.attacker.test/")).toThrow()
  })
  it("does not permit an arbitrary origin or protocol-relative escape", () => {
    for (const url of ["https://outside.example.test/", "//outside.example.test/"]) {
      expect(() => safePreviewUrl(url, "https://preview.example.test/", ["https://preview.example.test"])).toThrow(/not approved/)
    }
  })
})

describe("preview truth labels", () => {
  it("unknown is not private or ready", () => {
    expect(previewAccessLabel(undefined)).toBe("Access not verified")
    expect(previewReadinessLabel(undefined)).toBe("Application readiness not verified")
  })
  it("requires a valid observed HTTP success before reporting readiness", () => {
    expect(previewReadinessLabel({ state: "ready", checkedAt: "2026-09-24T00:00:00Z", statusCode: 200 })).toContain("HTTP 200")
    expect(previewReadinessLabel({ state: "ready", checkedAt: "invalid", statusCode: 200 })).toContain("not verified")
    expect(previewReadinessLabel({ state: "ready", checkedAt: "2026-09-24T00:00:00Z", statusCode: 503 })).toContain("not verified")
  })
  it("describes enforced access without making an encryption or isolation claim", () => {
    expect(previewAccessLabel({ state: "authenticated", source: "enforced-policy" })).toBe("Authentication required")
    expect(previewAccessLabel({ state: "public", source: "enforced-policy" })).toBe("Public URL")
  })
})
