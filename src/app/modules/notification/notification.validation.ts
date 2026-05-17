import { z } from "zod";

const registerFcmTokenSchema = z.object({
  deviceId: z
    .string({ required_error: "Device ID is required" })
    .min(1, "Device ID cannot be empty")
    .max(100, "Device ID is too long"),
  fcmToken: z
    .string({ required_error: "FCM token is required" })
    .min(1, "FCM token cannot be empty")
    .max(500, "FCM token is too long"),
  platform: z.enum(["ios", "android", "web"], {
    required_error: "Platform is required",
  }),
  deviceName: z.string().max(100, "Device name is too long").optional(),
});

const removeFcmTokenSchema = z.object({
  deviceId: z
    .string({ required_error: "Device ID is required" })
    .min(1, "Device ID cannot be empty"),
});

export const notificationValidation = {
  registerFcmTokenSchema,
  removeFcmTokenSchema,
};
