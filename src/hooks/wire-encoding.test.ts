import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeTextForWire } from "./wire-encoding";

/** Decode a wire text part the way a browser (and the sidecar) would. */
function decodeWire(b64: string): string {
  if (b64 === "") return "";
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Mirror of the sidecar's strict acceptance check
 * (agent-dev-container/apps/sidecar/src/lib/decode-text-parts.ts): re-encode
 * the decoded bytes and compare modulo padding — non-canonical/raw input is
 * rejected. If the client ever emits something the real server would 400,
 * this returns true. Keep in sync with that file.
 */
function sidecarWouldReject(b64: string): boolean {
  if (b64 === "") return false;
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    return true;
  }
  return btoa(bin).replace(/=+$/, "") !== b64.replace(/=+$/, "");
}

const SAMPLES = [
  "ping test", // the exact input from #183 — a space put it out of the base64 alphabet → 400
  "test", // coincidentally valid base64 → silently corrupted (not 400) before the fix
  "hello",
  "What's the weather? 12 + 3 = 15!", // punctuation / symbols
  "café ☕ — 日本語 🚀", // multibyte UTF-8 + emoji
  "line1\nline2\ttrailing\t", // embedded control whitespace
  "x".repeat(5000), // long
];

describe("encodeTextForWire", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces output the sidecar accepts and that round-trips to the original", () => {
    for (const text of SAMPLES) {
      const encoded = encodeTextForWire(text);
      expect(sidecarWouldReject(encoded)).toBe(false);
      expect(decodeWire(encoded)).toBe(text);
    }
  });

  it("actually encodes — the wire value is not the raw text (regression: #183 sent raw UTF-8)", () => {
    expect(encodeTextForWire("ping test")).not.toBe("ping test");
    // A space is not in the base64 alphabet, so the raw string would 400.
    expect(sidecarWouldReject("ping test")).toBe(true);
    expect(sidecarWouldReject(encodeTextForWire("ping test"))).toBe(false);
  });

  it("maps the empty string to the empty string (the sidecar passes it through untouched)", () => {
    expect(encodeTextForWire("")).toBe("");
  });

  it("falls back to Buffer when btoa is absent, with identical, server-valid output", () => {
    const viaBtoa = SAMPLES.map((t) => encodeTextForWire(t));

    vi.stubGlobal("btoa", undefined); // force the DOM-less Buffer branch
    const viaBuffer = SAMPLES.map((t) => encodeTextForWire(t));
    vi.unstubAllGlobals();

    expect(viaBuffer).toEqual(viaBtoa);
    for (let i = 0; i < SAMPLES.length; i++) {
      expect(decodeWire(viaBuffer[i])).toBe(SAMPLES[i]);
    }
  });

  it("throws a clear error when no base64 encoder is available", () => {
    vi.stubGlobal("btoa", undefined);
    vi.stubGlobal("Buffer", undefined);
    expect(() => encodeTextForWire("x")).toThrow(/no base64 encoder/);
  });
});
