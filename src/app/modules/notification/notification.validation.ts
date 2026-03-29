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

const sendToUserSchema = z.object({
  userId: z.string({ required_error: "User ID is required" }).min(1),
  title: z
    .string({ required_error: "Title is required" })
    .min(1, "Title cannot be empty")
    .max(200, "Title must not exceed 200 characters"),
  body: z
    .string({ required_error: "Body is required" })
    .min(1, "Body cannot be empty")
    .max(1000, "Body must not exceed 1000 characters"),
  data: z.record(z.string()).optional(),
  type: z
    .enum(["JOB_APPLICATION", "JOB_UPDATE", "MESSAGE", "SYSTEM", "MARKETING"])
    .optional(),
});

const sendToMultipleSchema = z.object({
  userIds: z
    .array(z.string())
    .min(1, "At least one user ID is required")
    .max(500, "Cannot send to more than 500 users at once"),
  title: z
    .string({ required_error: "Title is required" })
    .min(1, "Title cannot be empty")
    .max(200, "Title must not exceed 200 characters"),
  body: z
    .string({ required_error: "Body is required" })
    .min(1, "Body cannot be empty")
    .max(1000, "Body must not exceed 1000 characters"),
  data: z.record(z.string()).optional(),
  type: z
    .enum(["JOB_APPLICATION", "JOB_UPDATE", "MESSAGE", "SYSTEM", "MARKETING"])
    .optional(),
});

export const notificationValidation = {
  registerFcmTokenSchema,
  removeFcmTokenSchema,
  sendToUserSchema,
  sendToMultipleSchema,
};
