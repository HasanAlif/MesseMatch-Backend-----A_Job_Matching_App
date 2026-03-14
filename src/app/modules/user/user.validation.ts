import { z } from "zod";

// Registration validation - simple: fullName, mobileNumber, email, password
const CreateUserValidationSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100),
  email: z.string().email("Please provide a valid email"),
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Login validation
const UserLoginValidationSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  password: z.string().min(1, "Password is required"),
});

// Profile update validation
const UpdateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  mobileNumber: z.string().min(10).optional(),
});

// Verify registration OTP
const VerifyRegistrationOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

// Resend registration OTP
const ResendRegistrationOtpSchema = z.object({
  email: z.string().email("Please provide a valid email"),
});

// Helper: coerces a JSON string, comma-separated string, or array into an array of strings
const stringArrayField = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON — treat as comma-separated
    }
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return val;
}, z.array(z.string()));

// Complete profile as Fitter
const CompleteProfileAsFitterSchema = z.object({
  userName: z.string().min(2).max(50).optional(),
  fullName: z.string().min(2).max(100).optional(),
  postalCode: z.string().min(3).max(20).optional(),
  workLocations: stringArrayField.optional(),
  skills: stringArrayField.optional(),
  spokenLanguages: stringArrayField.optional(),
  driversLicense: z.string().optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  dailyRate: z.coerce.number().min(0).optional(),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  bio: z.string().max(1000).optional(),
  plan: z.enum(["FREE", "PREMIUM"]).optional(),
  lattitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

// Complete profile as Company
const CompleteProfileAsCompanySchema = z.object({
  companyName: z.string().min(2).max(150).optional(),
  businessEmail: z.string().email("Please provide a valid business email").optional(),
  contactPersonName: z.string().min(2).max(100).optional(),
  postalCode: z.string().min(3).max(20).optional(),
  lattitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

// Update plan
const UpdatePlanSchema = z.object({
  plan: z.enum(
    [
      "TRIAL",
      "BASIC_MONTHLY",
      "BASIC_ANNUAL",
      "PREMIUM_MONTHLY",
      "PREMIUM_ANNUAL",
    ],
    { required_error: "Plan is required" },
  ),
});

export const UserValidation = {
  CreateUserValidationSchema,
  UserLoginValidationSchema,
  UpdateProfileSchema,
  VerifyRegistrationOtpSchema,
  ResendRegistrationOtpSchema,
  UpdatePlanSchema,
  CompleteProfileAsFitterSchema,
  CompleteProfileAsCompanySchema,
};
