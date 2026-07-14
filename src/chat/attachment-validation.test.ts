import { describe, it, expect } from "vitest";
import {
  isAcceptedType,
  validateComposerFiles,
} from "./attachment-validation";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
}

describe("isAcceptedType", () => {
  it("accepts everything when accept is undefined", () => {
    expect(isAcceptedType(makeFile("a.exe", "application/x-msdownload", 1))).toBe(
      true,
    );
  });

  it("accepts everything when accept is empty", () => {
    expect(isAcceptedType(makeFile("a.exe", "application/x-msdownload", 1), "")).toBe(
      true,
    );
  });

  it("matches a file extension case-insensitively", () => {
    const file = makeFile("photo.PNG", "image/png", 10);
    expect(isAcceptedType(file, ".png")).toBe(true);
    expect(isAcceptedType(makeFile("photo.jpg", "image/jpeg", 10), ".png")).toBe(
      false,
    );
  });

  it("matches an exact MIME type", () => {
    const file = makeFile("photo.png", "image/png", 10);
    expect(isAcceptedType(file, "image/png")).toBe(true);
    expect(isAcceptedType(file, "image/jpeg")).toBe(false);
  });

  it("matches a MIME wildcard", () => {
    const file = makeFile("photo.png", "image/png", 10);
    expect(isAcceptedType(file, "image/*")).toBe(true);
    expect(isAcceptedType(file, "video/*")).toBe(false);
  });

  it("is whitespace-tolerant across comma-separated patterns", () => {
    const file = makeFile("doc.pdf", "application/pdf", 10);
    expect(isAcceptedType(file, " .png ,  application/pdf ")).toBe(true);
  });
});

describe("validateComposerFiles", () => {
  it("accepts a file under the size limit and rejects one over it", () => {
    const small = makeFile("small.png", "image/png", 100);
    const big = makeFile("big.png", "image/png", 10_000);
    const { accepted, rejected } = validateComposerFiles([small, big], {
      maxSizeBytes: 1_000,
    });
    expect(accepted).toEqual([small]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.file).toBe(big);
    expect(rejected[0]?.reason).toMatch(/big\.png/);
  });

  it("rejects files once the running count would exceed maxCount, honoring currentCount", () => {
    const a = makeFile("a.png", "image/png", 10);
    const b = makeFile("b.png", "image/png", 10);
    const c = makeFile("c.png", "image/png", 10);
    const { accepted, rejected } = validateComposerFiles([a, b, c], {
      maxCount: 3,
      currentCount: 2,
    });
    // Only one more slot is free (2 staged + 1 new = 3), so a is accepted and
    // b, c are rejected on count.
    expect(accepted).toEqual([a]);
    expect(rejected).toHaveLength(2);
    expect(rejected.map((r) => r.file)).toEqual([b, c]);
    expect(rejected[0]?.reason).toMatch(/3-file limit/);
  });

  it("checks accept before size and count", () => {
    const wrongType = makeFile("notes.txt", "text/plain", 10);
    const { accepted, rejected } = validateComposerFiles([wrongType], {
      accept: "image/*",
      maxSizeBytes: 1,
    });
    expect(accepted).toEqual([]);
    expect(rejected[0]?.reason).toMatch(/not an accepted file type/);
  });

  it("accepts everything when no config limits are set", () => {
    const files = [makeFile("a.txt", "text/plain", 10)];
    const { accepted, rejected } = validateComposerFiles(files, {});
    expect(accepted).toEqual(files);
    expect(rejected).toEqual([]);
  });

  it("returns a mixed batch of accepted and rejected files", () => {
    const ok = makeFile("ok.png", "image/png", 10);
    const tooBig = makeFile("huge.png", "image/png", 5_000);
    const wrongType = makeFile("doc.pdf", "application/pdf", 10);
    const { accepted, rejected } = validateComposerFiles(
      [ok, tooBig, wrongType],
      { accept: "image/*", maxSizeBytes: 1_000 },
    );
    expect(accepted).toEqual([ok]);
    expect(rejected.map((r) => r.file)).toEqual([tooBig, wrongType]);
  });

  it("accepts a FileList input, not just an array", () => {
    const dt = new DataTransfer();
    dt.items.add(makeFile("a.png", "image/png", 10));
    const { accepted } = validateComposerFiles(dt.files, {});
    expect(accepted).toHaveLength(1);
  });
});
