"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import { Logo, TangleKnot } from "@tangle-network/brand";

/**
 * Shared, self-contained sign-in / sign-up page for every Tangle vertical app.
 *
 * Ships its OWN palette (scoped CSS custom properties on the card) so it renders
 * identically in every app regardless of that app's theme tokens — the bug that
 * made per-app hand-rolled logins drift (e.g. a Tangle button rendering
 * dark-on-dark when an app didn't load the expected token sheet). Everything is
 * overridable via props for per-app customization (`accent`, `providers`, copy,
 * `className`/`style`).
 *
 * Each app's login route becomes a thin wrapper:
 *   export default () => <AuthPage product="Legal" tangleAuthUrl="/auth/tangle/start" />
 */

export type SocialProvider = "github" | "google";

export interface AuthPageProps {
  /** Suffix after the Tangle wordmark in the lockup, e.g. "Legal", "Tax". */
  product?: string;
  /** Sub-headline under the logo lockup. */
  tagline?: string;
  /** "signin" (default) or "signup" — flips copy + the email submit action. */
  mode?: "signin" | "signup";
  /**
   * Endpoint that starts the Tangle cross-site SSO flow. The app's server
   * 302-redirects this to the platform authorize URL. Default `/auth/tangle/start`.
   */
  tangleAuthUrl?: string;
  /** Social providers to surface; default `["github", "google"]`. Empty = none. */
  providers?: SocialProvider[];
  /** Build the social sign-in href. Default better-auth social endpoint. */
  socialHref?: (provider: SocialProvider) => string;
  /**
   * Email/password handler. Return an error message to show, or null on success
   * (the caller handles navigation). If omitted, the email form is hidden —
   * SSO/social only.
   */
  onEmailSubmit?: (email: string, password: string) => Promise<string | null>;
  /** Footer link target for the opposite mode (signup from signin, vice versa). */
  altHref?: string;
  /** Primary (Tangle) button background. Default Tangle ink `#0f172a`. */
  accent?: string;
  /** Primary button hover background. Default `#1e293b`. */
  accentHover?: string;
  /** Optional brand-mark size in the lockup. Default "lg". */
  logoSize?: "sm" | "md" | "lg" | "xl";
  /** Escape hatch: extra class on the card. */
  className?: string;
  /** Escape hatch: inline style merged onto the card. */
  style?: CSSProperties;
  /** Optional node rendered above the footer (legal copy, SSO notice, etc.). */
  children?: ReactNode;
}

// Self-contained palette — fixed values, NOT app theme tokens, so the page
// looks the same everywhere. `accent` is the only commonly-overridden color.
const C = {
  pageBg: "#f7f7f8",
  card: "#ffffff",
  border: "rgba(15, 23, 42, 0.10)",
  text: "#0f172a",
  muted: "#71717a",
  inputBg: "#f5f5f4",
};

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const SOCIAL_LABEL: Record<SocialProvider, string> = { github: "GitHub", google: "Google" };
const SOCIAL_ICON: Record<SocialProvider, ReactNode> = { github: <GithubIcon />, google: <GoogleIcon /> };

export function AuthPage({
  product,
  tagline,
  mode = "signin",
  tangleAuthUrl = "/auth/tangle/start",
  providers = ["github", "google"],
  socialHref = (p) => `/api/auth/sign-in/social?provider=${p}&callbackURL=/app`,
  onEmailSubmit,
  altHref,
  accent = "#0f172a",
  accentHover = "#1e293b",
  logoSize = "lg",
  className,
  style,
  children,
}: AuthPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";
  const tangleLabel = isSignup ? "Sign up with Tangle" : "Continue with Tangle";
  const emailLabel = isSignup ? "Create account with email" : "Sign in with email";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEmailSubmit) return;
    setLoading(true);
    setError("");
    try {
      const err = await onEmailSubmit(email, password);
      if (err) setError(err);
    } catch {
      setError("Connection error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const outlineBtn: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: "transparent",
    color: C.text,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 120ms",
  };
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.inputBg,
    color: C.text,
    fontSize: 14,
    outline: "none",
  };

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: C.pageBg }}
    >
      <div
        className={className}
        style={{
          width: "100%",
          maxWidth: 384,
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
          ...style,
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <Logo variant="full" suffix={product} size={logoSize} />
          {tagline !== null && (
            <p style={{ fontSize: 14, marginTop: 12, color: C.muted }}>
              {tagline ?? (isSignup ? `Create your ${product ?? "Tangle"} workspace.` : `Sign in to your ${product ?? "Tangle"} workspace.`)}
            </p>
          )}
        </div>

        {/* Primary: Tangle SSO — solid, self-styled (never theme-dependent). */}
        <a
          href={tangleAuthUrl}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            background: accent,
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            transition: "background 120ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = accentHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = accent)}
        >
          <TangleKnot size={16} />
          {tangleLabel}
        </a>

        {providers.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                style={outlineBtn}
                onClick={() => {
                  window.location.href = socialHref(p);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {SOCIAL_ICON[p]}
                Continue with {SOCIAL_LABEL[p]}
              </button>
            ))}
          </div>
        )}

        {onEmailSubmit && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 12, color: C.muted }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="email" required aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              <input type="password" required aria-label="Password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
              {error && (
                <p role="alert" style={{ fontSize: 14, color: "#b91c1c" }}>
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading} style={{ ...outlineBtn, opacity: loading ? 0.5 : 1 }}>
                {loading ? "…" : emailLabel}
              </button>
            </form>
          </>
        )}

        {children}

        {altHref && (
          <p style={{ textAlign: "center", fontSize: 14, marginTop: 24, color: C.muted }}>
            {isSignup ? "Already have an account? " : `New to Tangle${product ? ` ${product}` : ""}? `}
            <a href={altHref} style={{ fontWeight: 500, color: C.text }}>
              {isSignup ? "Sign in" : "Create account"}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
