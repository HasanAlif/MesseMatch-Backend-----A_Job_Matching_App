import { z } from "zod";

const getMonthlyUserGrowthSchema = z.object({
  query: z
    .object({
      year: z.coerce
        .number()
        .int()
        .min(1900, "Year must be 1900 or later")
        .max(2100, "Year must be 2100 or earlier")
        .optional()
        .default(new Date().getFullYear()),
    })
    .optional(),
});

const getAllUsersSchema = z.object({
  query: z
    .object({
      plan: z.string().optional(),
      status: z.string().optional(),
      page: z.coerce
        .number()
        .int()
        .min(1, "Page must be at least 1")
        .optional()
        .default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must not exceed 100")
        .optional()
        .default(10),
    })
    .optional(),
});

const searchUsersSchema = z.object({
  query: z
    .object({
      searchQuery: z.string().min(1, "Search query is required"),
      page: z.coerce
        .number()
        .int()
        .min(1, "Page must be at least 1")
        .optional()
        .default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must not exceed 100")
        .optional()
        .default(10),
    })
    .optional(),
});

export const adminValidation = {
  getMonthlyUserGrowthSchema,
  getAllUsersSchema,
  searchUsersSchema,
};
