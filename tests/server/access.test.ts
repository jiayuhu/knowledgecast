import { describe, expect, it } from "vitest";
import { validateOtp } from "@/server/share/otp";

describe("validateOtp", () => {
  it("rejects expired OTP codes", () => {
    const result = validateOtp({
      code: "123456",
      issuedAt: new Date("2026-04-01T00:00:00.000Z"),
      now: new Date("2026-04-01T00:11:00.000Z")
    });

    expect(result.ok).toBe(false);
  });
});
