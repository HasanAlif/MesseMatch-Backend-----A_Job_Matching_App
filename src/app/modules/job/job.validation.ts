import { z } from "zod";

const stringArrayField = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON - treat as comma-separated
    }
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return val;
}, z.array(z.string()));

const dateField = z.preprocess((val) => {
  if (val instanceof Date) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}, z.date().optional());

const createSchema = z
  .object({
    projectName: z
      .string({ required_error: "Project name is required" })
      .min(3, "Project name must be at least 3 characters")
      .max(200, "Project name must not exceed 200 characters")
      .trim(),
    projectLocation: z
      .string()
      .max(500, "Location must not exceed 500 characters")
      .trim()
      .optional(),
    projectPeriodFrom: dateField,
    projectPeriodTo: dateField,
    personNeeded: z.coerce
      .number()
      .int("Person needed must be an integer")
      .min(1, "At least 1 person is needed")
      .max(1000, "Cannot exceed 1000 persons")
      .optional(),
    hourlyRate: z.coerce
      .number()
      .min(0, "Hourly rate cannot be negative")
      .optional(),
    maximumRate: z.coerce
      .number()
      .min(0, "Maximum rate cannot be negative")
      .optional(),
    minimumRate: z.coerce
      .number()
      .min(0, "Minimum rate cannot be negative")
      .optional(),
    requieredSkills: stringArrayField.optional(),
    requiredLanguages: stringArrayField.optional(),
    driversLicense: z.string().trim().optional(),
    additionalInformation: z
      .string()
      .max(5000, "Additional information must not exceed 5000 characters")
      .trim()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.projectPeriodFrom && data.projectPeriodTo) {
        return data.projectPeriodFrom <= data.projectPeriodTo;
      }
      return true;
    },
    {
      message: "Project end date must be after start date",
      path: ["projectPeriodTo"],
    },
  )
  .refine(
    (data) => {
      if (data.minimumRate !== undefined && data.maximumRate !== undefined) {
        return data.minimumRate <= data.maximumRate;
      }
      return true;
    },
    {
      message: "Maximum rate must be greater than or equal to minimum rate",
      path: ["maximumRate"],
    },
  );

const updateSchema = z
  .object({
    projectName: z
      .string()
      .min(3, "Project name must be at least 3 characters")
      .max(200, "Project name must not exceed 200 characters")
      .trim()
      .optional(),
    projectLocation: z
      .string()
      .max(500, "Location must not exceed 500 characters")
      .trim()
      .optional(),
    projectPeriodFrom: dateField,
    projectPeriodTo: dateField,
    personNeeded: z.coerce
      .number()
      .int("Person needed must be an integer")
      .min(1, "At least 1 person is needed")
      .max(1000, "Cannot exceed 1000 persons")
      .optional(),
    hourlyRate: z.coerce
      .number()
      .min(0, "Hourly rate cannot be negative")
      .optional(),
    maximumRate: z.coerce
      .number()
      .min(0, "Maximum rate cannot be negative")
      .optional(),
    minimumRate: z.coerce
      .number()
      .min(0, "Minimum rate cannot be negative")
      .optional(),
    requieredSkills: stringArrayField.optional(),
    requiredLanguages: stringArrayField.optional(),
    driversLicense: z.string().trim().optional(),
    additionalInformation: z
      .string()
      .max(5000, "Additional information must not exceed 5000 characters")
      .trim()
      .optional(),
    jobStatus: z.enum(["ACTIVE", "PAUSED"]).optional(),
  })
  .refine(
    (data) => {
      if (data.projectPeriodFrom && data.projectPeriodTo) {
        return data.projectPeriodFrom <= data.projectPeriodTo;
      }
      return true;
    },
    {
      message: "Project end date must be after start date",
      path: ["projectPeriodTo"],
    },
  )
  .refine(
    (data) => {
      if (data.minimumRate !== undefined && data.maximumRate !== undefined) {
        return data.minimumRate <= data.maximumRate;
      }
      return true;
    },
    {
      message: "Maximum rate must be greater than or equal to minimum rate",
      path: ["maximumRate"],
    },
  );

export const jobValidation = {
  createSchema,
  updateSchema,
};
