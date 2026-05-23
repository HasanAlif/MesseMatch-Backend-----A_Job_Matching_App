import { z } from "zod";
import { AuthProvider } from "../../models";

// FCM-related fields are passed through without validation; the service layer
// guards against bad data via truthy-checks + try/catch around registration.
const fcmField = z.any();

const loginValidationSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
  fcmToken: fcmField,
  deviceId: fcmField,
  platform: fcmField,
  deviceName: fcmField,
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

const logoutValidationSchema = z.object({
  deviceId: fcmField,
});

const socialLoginSchema = z
  .object({
    email: z.string().email("Please provide a valid email"),
    name: z.string().min(1, "Name is required"),
    profileImage: z.any(),
    provider: z.nativeEnum(AuthProvider),
    providerId: z.string().min(1, "Provider ID is required"),
    fcmToken: fcmField,
    deviceId: fcmField,
    deviceType: fcmField,
    deviceName: fcmField,
  })
  .refine((data) => data.provider !== AuthProvider.LOCAL, {
    message: "LOCAL provider is not allowed for social login",
    path: ["provider"],
  });

export const authValidation = {
  loginValidationSchema,
  logoutValidationSchema,
  changePasswordValidationSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordValidationSchema,
  resendOtpSchema,
  socialLoginSchema,
};
