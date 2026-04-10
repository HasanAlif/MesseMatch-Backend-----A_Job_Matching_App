import mongoose from "mongoose";
import { z } from "zod";
import { JobRequestStatus } from "../job/jobRequest.model";

const requestForJobSchema = z.object({
  jobId: z
    .string({ required_error: "Job ID is required" })
    .refine((value) => mongoose.Types.ObjectId.isValid(value), {
      message: "Invalid job ID format",
    }),
});

const updateRequestStatusSchema = z.object({
  requestStatus: z.enum([
    JobRequestStatus.ACCEPTED,
    JobRequestStatus.REJECTED,
  ] as const),
});

const giveRatingAndReviewSchema = z.object({
  rating: z
    .number({ required_error: "Rating is required" })
    .int("Rating must be an integer")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  review: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(1000, "Review must be at most 1000 characters")
    .optional(),
});

const searchAndFilterJobsSchema = z
  .object({
    latitude: z
      .number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .optional(),
    longitude: z
      .number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .optional(),
    distanceKm: z
      .number()
      .min(1, "Distance must be at least 1 km")
      .max(500, "Distance cannot exceed 500 km")
      .optional(),
    requiredSkills: z.array(z.string()).optional(),
    minimumRate: z
      .number()
      .min(0, "Minimum rate must be non-negative")
      .optional(),
    maximumRate: z
      .number()
      .min(0, "Maximum rate must be non-negative")
      .optional(),
    projectPeriodFrom: z.string().datetime().optional(),
    projectPeriodTo: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (
        (data.latitude !== undefined && data.longitude === undefined) ||
        (data.latitude === undefined && data.longitude !== undefined)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Both latitude and longitude must be provided together",
      path: ["latitude"],
    },
  )
  .refine(
    (data) => {
      if (
        data.projectPeriodFrom &&
        data.projectPeriodTo &&
        new Date(data.projectPeriodFrom) > new Date(data.projectPeriodTo)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Project period 'from' date must be before 'to' date",
      path: ["projectPeriodFrom"],
    },
  );

export const matchingValidation = {
  requestForJobSchema,
  updateRequestStatusSchema,
  giveRatingAndReviewSchema,
  searchAndFilterJobsSchema,
};
