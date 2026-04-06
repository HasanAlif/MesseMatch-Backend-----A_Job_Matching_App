import mongoose from "mongoose";
import { z } from "zod";

const requestForJobSchema = z.object({
  jobId: z
    .string({ required_error: "Job ID is required" })
    .refine((value) => mongoose.Types.ObjectId.isValid(value), {
      message: "Invalid job ID format",
    }),
});

export const matchingValidation = {
  requestForJobSchema,
};
