import { z } from "zod";

const updateCompanyProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must not exceed 100 characters")
    .trim()
    .optional(),
  mobileNumber: z
    .string()
    .min(10, "Mobile number must be at least 10 characters")
    .max(20, "Mobile number must not exceed 20 characters")
    .trim()
    .optional(),
});

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileValidation = {
  updateCompanyProfileSchema,
  changePasswordSchema,
};
