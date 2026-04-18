import mongoose, { Document, Schema } from "mongoose";

export enum JobRequestStatus {
  REQUESTED = "REQUESTED",
  REJECTED = "REJECTED",
  ACCEPTED = "ACCEPTED",
  COMPLETED = "COMPLETED",
}

export interface IJobRequest extends Document {
  _id: string;
  jobId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  fitterId: mongoose.Types.ObjectId;
  profilePicture?: string;
  distance?: number;
  userName?: string;
  rating?: number;
  jobCompleted?: number;
  workLocations?: string[];
  hourlyRate?: number;
  dailyRate?: number;
  spokenLanguages?: string[];
  skills?: string[];
  requestStatus: JobRequestStatus;
  companyRating?: number;
  companyReview?: string;
  reviewedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobRequestSchema = new Schema<IJobRequest>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fitterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    profilePicture: {
      type: String,
    },
    distance: {
      type: Number,
    },
    userName: {
      type: String,
    },
    rating: {
      type: Number,
    },
    jobCompleted: {
      type: Number,
    },
    workLocations: [
      {
        type: String,
      },
    ],
    hourlyRate: {
      type: Number,
    },
    dailyRate: {
      type: Number,
    },
    spokenLanguages: [
      {
        type: String,
      },
    ],
    skills: [
      {
        type: String,
      },
    ],
    requestStatus: {
      type: String,
      enum: Object.values(JobRequestStatus),
      default: JobRequestStatus.REQUESTED,
    },
    companyRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    companyReview: {
      type: String,
    },
    reviewedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

JobRequestSchema.index(
  { jobId: 1, fitterId: 1, requestStatus: 1 },
  { name: "idx_active_requests" },
);
JobRequestSchema.index({ companyId: 1, requestStatus: 1, createdAt: -1 });
JobRequestSchema.index({ fitterId: 1, createdAt: -1 });

export const JobRequest = mongoose.model<IJobRequest>(
  "JobRequest",
  JobRequestSchema,
);

export const migrateJobRequestIndexes = async () => {
  try {
    const collection = JobRequest.collection;
    await collection.dropIndex("jobId_1_fitterId_1").catch(() => {});
    await JobRequest.syncIndexes();
  } catch (error) {
    console.error("Error migrating JobRequest indexes:", error);
  }
};
