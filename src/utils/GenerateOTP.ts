import crypto from "crypto";

export const generateOTP = (
  validTime: number = 1,
): { otp: number; otpExpires: Date } => {
  const otp = Number(crypto.randomInt(1000, 9999));

  const otpExpires = new Date(Date.now() + validTime * 60 * 1000);

  return { otp, otpExpires };
};
