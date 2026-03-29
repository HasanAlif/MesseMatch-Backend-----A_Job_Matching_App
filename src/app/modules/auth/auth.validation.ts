import { z } from "zod";

const loginValidationSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
  fcmToken: z.string().max(500).optional(),
  deviceId: z.string().max(100).optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
  deviceName: z.string().max(100).optional(),
});

const changePasswordValidationSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email"),
});

const verifyOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const resetPasswordValidationSchema = z
  .object({
    email: z.string().email("Please provide a valid email"),
    otp: z.string().length(6, "OTP must be 6 digits"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const resendOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
});

export const authValidation = {
  loginValidationSchema,
  changePasswordValidationSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordValidationSchema,
  resendOtpSchema,
};
