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

export const matchingValidation = {
  requestForJobSchema,
  updateRequestStatusSchema,
};
