import { describe, expect, test } from "bun:test";

function isAuthorized(secret: string | undefined, authorization: string | null) {
  if (!secret) return false;
  return authorization === `Bearer ${secret}`;
}

describe("Deriv ingestion trigger authorization", () => {
  test("fails closed when CRON_SECRET is missing", () => {
    expect(isAuthorized(undefined, "Bearer anything")).toBe(false);
  });

  test("rejects missing or incorrect bearer credentials", () => {
    expect(isAuthorized("expected", null)).toBe(false);
    expect(isAuthorized("expected", "Bearer wrong")).toBe(false);
  });

  test("accepts the exact configured bearer credential", () => {
    expect(isAuthorized("expected", "Bearer expected")).toBe(true);
  });
});
