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

export const matchingValidation = {
  requestForJobSchema,
  updateRequestStatusSchema,
  giveRatingAndReviewSchema,
};
