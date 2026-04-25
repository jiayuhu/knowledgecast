import { describe, expect, it } from "vitest";
import { shouldAllowRequest } from "@/server/rate-limit";

describe("shouldAllowRequest", () => {
  it("blocks repeated access bursts", () => {
    const result = shouldAllowRequest({
      key: "share:token_1",
      now: Date.now(),
      history: [1, 2, 3, 4, 5],
      limit: 5
    });

    expect(result.allowed).toBe(false);
  });
});
