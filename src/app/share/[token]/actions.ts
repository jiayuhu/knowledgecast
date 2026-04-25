"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAccessGrant,
  createShareOtpChallenge,
  getShareLinkByToken,
  verifyShareOtpChallenge
} from "@/server/share/access";

export type ShareGateState = {
  message: string;
  debugCode?: string;
};

export async function requestShareAccess(
  previousState: ShareGateState,
  formData: FormData
): Promise<ShareGateState> {
  const shareToken = String(formData.get("shareToken") ?? "");
  const email = String(formData.get("email") ?? "");
  const link = await getShareLinkByToken(shareToken);

  if (!link) {
    return { message: "Share link not found or expired." };
  }

  const challenge = createShareOtpChallenge({ shareToken, email });
  return {
    message: "Verification code generated.",
    debugCode: process.env.NODE_ENV === "production" ? undefined : challenge.code
  };
}

export async function verifyShareAccess(
  previousState: ShareGateState,
  formData: FormData
): Promise<ShareGateState> {
  const shareToken = String(formData.get("shareToken") ?? "");
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  const link = await getShareLinkByToken(shareToken);

  if (!link) {
    return { message: "Share link not found or expired." };
  }

  const challenge = verifyShareOtpChallenge({ shareToken, email, code });
  if (!challenge) {
    return { message: "Invalid or expired verification code." };
  }

  const grant = await createAccessGrant({
    shareLinkId: link.id,
    email
  });

  const cookieStore = await cookies();
  cookieStore.set(`knowledgecast_access_${shareToken}`, grant.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: grant.expiresAt
  });

  redirect(`/share/${shareToken}`);
}
