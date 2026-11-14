import { afterEach, describe, expect, it, vi } from "vitest";
import { validateUploadKey } from "./object-storage";

describe("object storage object key validation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("allows keys only under the uploads prefix", () => {
    expect(validateUploadKey("uploads/avatar/user-1.png")).toBe("uploads/avatar/user-1.png");
    expect(() => validateUploadKey("private/user-1.png")).toThrow();
  });

  it("rejects traversal, backslashes, and control characters", () => {
    expect(() => validateUploadKey("uploads/../private.txt")).toThrow();
    expect(() => validateUploadKey("uploads\\private.txt")).toThrow();
    expect(() => validateUploadKey("uploads/file\n.txt")).toThrow();
  });
});
