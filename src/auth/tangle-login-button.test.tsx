import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TangleLoginButton } from "./tangle-login-button";

describe("TangleLoginButton", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "http://localhost/" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("defaults to /auth/tangle on click", () => {
    render(<TangleLoginButton />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with tangle/i }));
    expect(window.location.href).toBe("/auth/tangle");
  });

  it("honors a custom authUrl prop", () => {
    render(<TangleLoginButton authUrl="/api/auth/tangle?redirect=/app" />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with tangle/i }));
    expect(window.location.href).toBe("/api/auth/tangle?redirect=/app");
  });

  it("renders a custom label via children", () => {
    render(<TangleLoginButton>Continue with Tangle</TangleLoginButton>);
    expect(
      screen.getByRole("button", { name: /continue with tangle/i }),
    ).toBeInTheDocument();
  });
});
