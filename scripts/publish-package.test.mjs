import { afterEach, describe, expect, it, vi } from "vitest";
import { registryPackageUrl, registryShasum } from "./publish-package.mjs";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registryPackageUrl", () => {
  it("encodes a scoped package name", () => {
    expect(
      registryPackageUrl("https://registry.npmjs.org", "@tangle-network/sandbox-ui"),
    ).toBe("https://registry.npmjs.org/@tangle-network%2Fsandbox-ui");
  });
});

describe("registryShasum", () => {
  const options = {
    registry: "https://registry.example.test",
    packageName: "@tangle-network/sandbox-ui",
    version: "0.87.1",
  };

  it("returns the published package SHA-1", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ versions: { "0.87.1": { dist: { shasum: "abc123" } } } }),
        { status: 200 },
      ),
    );

    await expect(registryShasum({ ...options, fetchImpl })).resolves.toBe("abc123");
  });

  it("treats only a 404 as an unpublished version", async () => {
    const missingFetch = vi.fn().mockResolvedValue(new Response("missing", { status: 404 }));
    const missingVersionFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ versions: { "0.87.0": {} } }), { status: 200 }),
    );
    const failedFetch = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));

    await expect(registryShasum({ ...options, fetchImpl: missingFetch })).resolves.toBeNull();
    await expect(registryShasum({ ...options, fetchImpl: missingVersionFetch })).resolves.toBeNull();
    await expect(registryShasum({ ...options, fetchImpl: failedFetch })).rejects.toThrow(
      "returned HTTP 503",
    );
  });

  it("rejects malformed successful metadata", async () => {
    const missingVersions = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const missingShasum = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ versions: { "0.87.1": { dist: {} } } }), { status: 200 }),
    );

    await expect(registryShasum({ ...options, fetchImpl: missingVersions })).rejects.toThrow(
      "without versions",
    );
    await expect(registryShasum({ ...options, fetchImpl: missingShasum })).rejects.toThrow(
      "without dist.shasum",
    );
  });

  it("authenticates private registry reads without leaking the token into the URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ versions: { "0.87.1": { dist: { shasum: "abc123" } } } }),
        { status: 200 },
      ),
    );

    await registryShasum({ ...options, token: "secret-token", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://registry.example.test/@tangle-network%2Fsandbox-ui",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer secret-token" }),
      }),
    );
  });
});
