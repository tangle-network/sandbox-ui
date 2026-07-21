/**
 * Sidecar message wire-encoding.
 *
 * The sidecar's send-message route (`POST /session/sessions/:id/messages`)
 * base64-DECODES every text part at the request boundary (`decodeTextParts`)
 * and hands the original UTF-8 to the agent — the LLM never sees base64. The
 * encoding is done unconditionally because readable prompt bodies
 * false-positive on ingress WAF rules that pattern-match shell-injection-shaped
 * substrings (which legitimate prompts routinely contain). A client that posts
 * raw UTF-8 is rejected with `400 INVALID_REQUEST` (or, for input that happens
 * to be valid base64, silently mis-decoded to garbage). So text parts MUST be
 * base64-encoded here before they go on the wire.
 *
 * Mirrors the sandbox SDK's `encodeTextForWire` (products/sandbox/sdk) — the
 * two must stay byte-compatible with the same server decoder. This package
 * ships to the browser, so `btoa` is the primary path (also present in jsdom
 * and modern Node); `Buffer` is a fallback for a DOM-less runtime.
 */

type BufferCtorLike = {
  from(input: string, encoding: string): { toString(encoding: string): string };
};

/** btoa handles only latin-1; widen each UTF-8 byte into its own char first. */
function utf8ToLatin1(text: string): string {
  return encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

export function encodeTextForWire(text: string): string {
  if (typeof btoa === "function") {
    return btoa(utf8ToLatin1(text));
  }
  // DOM-less runtime (some SSR/Node contexts) — fall back to Buffer, reached
  // via globalThis so this browser package needn't depend on @types/node.
  const bufferCtor = (globalThis as { Buffer?: BufferCtorLike }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(text, "utf8").toString("base64");
  }
  throw new Error(
    "encodeTextForWire: no base64 encoder available (btoa and Buffer both undefined)",
  );
}
