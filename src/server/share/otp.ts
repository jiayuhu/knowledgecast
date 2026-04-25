const OTP_TTL_MS = 10 * 60 * 1000;

export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function validateOtp(input: {
  code: string;
  issuedAt: Date;
  now: Date;
}) {
  const ageMs = input.now.getTime() - input.issuedAt.getTime();
  const ok = /^\d{6}$/.test(input.code) && ageMs >= 0 && ageMs <= OTP_TTL_MS;

  return { ok };
}
