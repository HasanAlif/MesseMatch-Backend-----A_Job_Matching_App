import { z } from "zod";
import mongoose from "mongoose";
import { MESSAGE_CONFIG } from "./message.constants";

const objectIdSchema = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid user ID format",
  });

export const getMessagesSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  query: z
    .object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(MESSAGE_CONFIG.MAX_PAGE_SIZE)
        .optional()
        .default(MESSAGE_CONFIG.DEFAULT_PAGE_SIZE),
    })
    .optional(),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    text: z
      .string()
      .max(
        MESSAGE_CONFIG.MAX_TEXT_LENGTH,
        `Message text cannot exceed ${MESSAGE_CONFIG.MAX_TEXT_LENGTH} characters`,
      )
      .optional(),
  }),
});

export const messageValidation = {
  getMessagesSchema,
  sendMessageSchema,
};
