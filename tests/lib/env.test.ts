import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("rejects missing DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
