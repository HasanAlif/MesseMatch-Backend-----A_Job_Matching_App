import mongoose, { Document, Schema } from "mongoose";

export enum JobStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
}

export interface IJob extends Document {
  _id: string;
  projectName: string;
  projectPicture?: string;
  projectPicturePublicId?: string;
  projectLocation?: string;
  projectPeriodFrom?: Date;
  projectPeriodTo?: Date;
  personNeeded?: number;
  hourlyRate?: number;
  maximumRate?: number;
  minimumRate?: number;
  requieredSkills?: string[];
  requiredLanguages?: string[];
  driversLicense?: string;
  additionalInformation?: string;
  jobStatus?: JobStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    projectPicture: {
      type: String,
      trim: true,
    },
    projectPicturePublicId: {
      type: String,
      trim: true,
    },
    projectLocation: {
      type: String,
      trim: true,
    },
    projectPeriodFrom: {
      type: Date,
    },
    projectPeriodTo: {
      type: Date,
    },
    personNeeded: {
      type: Number,
    },
    hourlyRate: {
      type: Number,
    },
    maximumRate: {
      type: Number,
    },
    minimumRate: {
      type: Number,
    },
    requieredSkills: {
      type: [String],
    },
    requiredLanguages: {
      type: [String],
    },
    driversLicense: {
      type: String,
    },
    additionalInformation: {
      type: String,
    },
    jobStatus: {
      type: String,
      enum: JobStatus,
      default: JobStatus.ACTIVE,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
JobSchema.index({ createdBy: 1, jobStatus: 1 });

export const Job = mongoose.model<IJob>("Job", JobSchema);
