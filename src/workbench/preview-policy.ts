export type PreviewReadiness =
  | { state: "unknown" }
  | { state: "checking" }
  | { state: "ready"; checkedAt: string; statusCode: number }
  | { state: "failed"; checkedAt: string; message: string }

export type PreviewAccess =
  | { state: "unknown" }
  | { state: "public" | "authenticated"; source: "enforced-policy"; expiresAt?: string }

/** Only an actual verified HTTP outcome can establish application readiness. */
export function previewReadinessLabel(readiness: PreviewReadiness | undefined): string {
  if (readiness?.state === "checking") return "Checking application readiness"
  if (readiness?.state === "failed") return "Application check failed"
  if (readiness?.state === "ready" && Number.isFinite(Date.parse(readiness.checkedAt)) &&
      Number.isInteger(readiness.statusCode) && readiness.statusCode >= 200 && readiness.statusCode < 400) {
    return `Application responded: HTTP ${readiness.statusCode}`
  }
  return "Application readiness not verified"
}

export function previewAccessLabel(access: PreviewAccess | undefined): string {
  if (!access || access.state === "unknown" || access.source !== "enforced-policy") return "Access not verified"
  return access.state === "public" ? "Public URL" : "Authentication required"
}

/** The product supplies the initial URL and any additional approved origins. */
export function safePreviewUrl(value: string, base?: string, allowedOrigins?: readonly string[]): string {
  let url: URL
  try { url = base ? new URL(value, base) : new URL(value) }
  catch { throw new Error("Enter a valid preview URL.") }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Use an HTTPS preview URL, or HTTP on localhost for local development.")
  }
  if (url.username || url.password) throw new Error("Preview URLs must not contain credentials.")
  if (allowedOrigins && !allowedOrigins.includes(url.origin)) throw new Error("That origin is not approved for this sandbox preview.")
  return url.href
}
