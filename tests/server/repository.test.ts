import { beforeEach, describe, expect, it } from "vitest";
import { createShareLink, revokeShareLink } from "@/server/share/repository";
import { getDb } from "@/server/db/client";
import { shareLinks } from "@/server/db/schema";

describe("share repository", () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.delete(shareLinks).run();
  });

  it("revokes a share link", async () => {
    const created = await createShareLink({
      trainingPageId: "page_1",
      token: "token_1",
      expiresAt: new Date("2026-05-01T00:00:00.000Z")
    });

    const revoked = await revokeShareLink(created.id);
    expect(revoked.status).toBe("revoked");
  });
});
