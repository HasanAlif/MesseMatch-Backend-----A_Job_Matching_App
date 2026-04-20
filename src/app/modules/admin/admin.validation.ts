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

const updateAdminProfileSchema = z.object({
  body: z
    .object({
      fullName: z
        .string()
        .min(2, "Full name must be at least 2 characters")
        .max(100, "Full name must not exceed 100 characters")
        .optional(),
    })
    .optional(),
});

const changeUserStatusSchema = z.object({
  params: z.object({
    userId: z.string().length(24, "Invalid user ID format"),
  }),
  body: z.object({
    status: z.enum(["ACTIVE", "SUSPEND"], {
      errorMap: () => ({ message: "Status must be either ACTIVE or SUSPEND" }),
    }),
  }),
});

export const adminValidation = {
  getMonthlyUserGrowthSchema,
  getAllUsersSchema,
  searchUsersSchema,
  changeUserStatusSchema,
  updateAdminProfileSchema,
};
