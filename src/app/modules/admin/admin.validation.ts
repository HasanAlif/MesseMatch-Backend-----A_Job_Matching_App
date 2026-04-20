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

export const adminValidation = {
  getMonthlyUserGrowthSchema,
};
