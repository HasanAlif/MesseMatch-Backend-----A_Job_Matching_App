import { z } from "zod";
import { AuthProvider } from "../../models";

const loginValidationSchema = z
  .object({
    email: z.string().email("Please provide a valid email"),
    password: z.string().min(1, "Password is required"),
    fcmToken: z
      .string()
      .max(500, "FCM token must not exceed 500 characters")
      .regex(/^[a-zA-Z0-9_-]+$/, "FCM token contains invalid characters")
      .optional(),
    deviceId: z
      .string()
      .min(4, "Device ID must be at least 4 characters")
      .max(256, "Device ID must not exceed 256 characters")
      .regex(
        /^[a-zA-Z0-9._:-]+$/,
        "Device ID contains invalid characters (supports UUIDs, platform IDs)",
      )
      .optional(),
    platform: z
      .enum(["ios", "android", "web"], {
        errorMap: () => ({
          message: 'Platform must be "ios", "android", or "web"',
        }),
      })
      .optional(),
    deviceName: z
      .string()
      .min(1, "Device name must not be empty")
      .max(100, "Device name must not exceed 100 characters")
      .regex(
        /^[a-zA-Z0-9\s\-._()&]+$/,
        "Device name contains invalid characters",
      )
      .optional(),
  })
  .refine(
    (data) => {
      const { deviceId, fcmToken, platform } = data;
      const hasAny = deviceId || fcmToken || platform;
      const hasAll = deviceId && fcmToken && platform;
      // If any device field provided, all must be provided (all-or-nothing)
      return !hasAny || hasAll;
    },
    {
      message:
        "If providing device info, deviceId, fcmToken, and platform are all required",
    },
  );

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
  deviceId: z
    .string()
    .min(4, "Device ID must be at least 4 characters")
    .max(256, "Device ID must not exceed 256 characters")
    .regex(
      /^[a-zA-Z0-9._:-]+$/,
      "Device ID contains invalid characters (supports UUIDs, platform IDs)",
    )
    .optional(),
});

const socialLoginSchema = z
  .object({
    email: z.string().email("Please provide a valid email"),
    name: z.string().min(1, "Name is required"),
    profileImage: z
      .string()
      .url("Please provide a valid profile image URL")
      .optional(),
    provider: z.nativeEnum(AuthProvider),
    providerId: z.string().min(1, "Provider ID is required"),
    fcmToken: z
      .string()
      .max(500, "FCM token must not exceed 500 characters")
      .regex(/^[a-zA-Z0-9_-]+$/, "FCM token contains invalid characters")
      .optional(),
    deviceId: z
      .string()
      .min(4, "Device ID must be at least 4 characters")
      .max(256, "Device ID must not exceed 256 characters")
      .regex(
        /^[a-zA-Z0-9._:-]+$/,
        "Device ID contains invalid characters (supports UUIDs, platform IDs)",
      )
      .optional(),
    deviceType: z
      .enum(["ios", "android", "web"], {
        errorMap: () => ({
          message: 'Device type must be "ios", "android", or "web"',
        }),
      })
      .optional(),
    deviceName: z
      .string()
      .min(1, "Device name must not be empty")
      .max(100, "Device name must not exceed 100 characters")
      .regex(
        /^[a-zA-Z0-9\s\-._()&]+$/,
        "Device name contains invalid characters",
      )
      .optional(),
  })
  .refine(
    (data) => {
      const { deviceId, fcmToken, deviceType } = data;
      const hasAny = deviceId || fcmToken || deviceType;
      const hasAll = deviceId && fcmToken && deviceType;
      return !hasAny || !!hasAll;
    },
    {
      message:
        "If providing device info, deviceId, fcmToken, and deviceType are all required",
    },
  )
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
