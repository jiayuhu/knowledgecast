import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { recordAuditEvent } from "../audit";
import { getDb } from "../db/client";
import { accessTokens, shareLinks, trainingPages } from "../db/schema";
import { generateOtpCode, validateOtp } from "./otp";

type OtpChallenge = {
  code: string;
  issuedAt: Date;
  shareToken: string;
  email: string;
};

const otpChallenges = new Map<string, OtpChallenge>();

function challengeKey(shareToken: string, email: string) {
  return `${shareToken}:${email.toLowerCase()}`;
}

export async function getShareLinkByToken(token: string) {
  const db = await getDb();
  const rows = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).all();
  const row = rows[0];

  if (!row || row.status !== "active" || row.expiresAt <= new Date()) {
    return null;
  }

  return row;
}

export async function getTrainingPageById(id: string) {
  const db = await getDb();
  const rows = await db.select().from(trainingPages).where(eq(trainingPages.id, id)).all();
  return rows[0] ?? null;
}

export function createShareOtpChallenge(input: {
  shareToken: string;
  email: string;
}) {
  const code = generateOtpCode();
  const issuedAt = new Date();
  const challenge = {
    code,
    issuedAt,
    shareToken: input.shareToken,
    email: input.email
  };

  otpChallenges.set(challengeKey(input.shareToken, input.email), challenge);
  void recordAuditEvent({
    eventType: "share_otp_requested",
    payload: {
      shareToken: input.shareToken,
      email: input.email
    },
    actorEmail: input.email
  });
  return challenge;
}

export function verifyShareOtpChallenge(input: {
  shareToken: string;
  email: string;
  code: string;
}) {
  const challenge = otpChallenges.get(challengeKey(input.shareToken, input.email));
  if (!challenge) {
    return null;
  }

  const result = validateOtp({
    code: input.code,
    issuedAt: challenge.issuedAt,
    now: new Date()
  });

  if (!result.ok || challenge.code !== input.code) {
    return null;
  }

  otpChallenges.delete(challengeKey(input.shareToken, input.email));
  void recordAuditEvent({
    eventType: "share_otp_verified",
    payload: {
      shareToken: input.shareToken,
      email: input.email
    },
    actorEmail: input.email
  });
  return challenge;
}

export async function createAccessGrant(input: {
  shareLinkId: string;
  email: string;
}) {
  const db = await getDb();
  const now = new Date();
  const token = randomUUID();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const grant = {
    id: randomUUID(),
    shareLinkId: input.shareLinkId,
    email: input.email,
    token,
    expiresAt,
    createdAt: now
  };

  await db.insert(accessTokens).values(grant).run();
  void recordAuditEvent({
    eventType: "access_granted",
    payload: {
      shareLinkId: input.shareLinkId,
      email: input.email,
      accessToken: grant.token
    },
    actorEmail: input.email
  });
  return grant;
}

export async function getAccessGrantByToken(token: string) {
  const db = await getDb();
  const rows = await db.select().from(accessTokens).where(and(eq(accessTokens.token, token), gt(accessTokens.expiresAt, new Date()))).all();
  return rows[0] ?? null;
}
