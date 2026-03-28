import mongoose from "mongoose";
import { Job, IJob } from "./job.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { fileUploader } from "../../../helpars/fileUploader";

interface CreateJobPayload {
  projectName: string;
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
}

interface UpdateJobPayload extends Partial<CreateJobPayload> {
  jobStatus?: "ACTIVE" | "PAUSED";
}

// Helper function to format date range based on month and year differences
const formatProjectPeriod = (
  periodFrom?: Date,
  periodTo?: Date,
): string | undefined => {
  if (!periodFrom || !periodTo) return undefined;

  const fromDate = new Date(periodFrom);
  const toDate = new Date(periodTo);

  const fromDay = fromDate.getDate();
  const fromMonth = fromDate.toLocaleString("en-US", { month: "long" });
  const fromYear = fromDate.getFullYear();

  const toDay = toDate.getDate();
  const toMonth = toDate.toLocaleString("en-US", { month: "long" });
  const toYear = toDate.getFullYear();

  // Same month and year: "10-14 April 2026"
  if (fromMonth === toMonth && fromYear === toYear) {
    return `${fromDay}-${toDay} ${toMonth} ${toYear}`;
  }

  // Same year but different months: "10 April - 20 July 2026"
  if (fromYear === toYear) {
    return `${fromDay} ${fromMonth} - ${toDay} ${toMonth} ${toYear}`;
  }

  // Different years: "10 April 2026 - 20 July 2027"
  return `${fromDay} ${fromMonth} ${fromYear} - ${toDay} ${toMonth} ${toYear}`;
};

const createJob = async (
  companyId: string,
  payload: CreateJobPayload,
  projectPictureFile?: Express.Multer.File,
): Promise<IJob> => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const jobData: Record<string, unknown> = {
    ...payload,
    createdBy: new mongoose.Types.ObjectId(companyId),
  };

  if (projectPictureFile) {
    const uploaded = await fileUploader.uploadToCloudinary(
      projectPictureFile,
      "messematch/jobs",
    );
    jobData.projectPicture = uploaded.Location;
    jobData.projectPicturePublicId = uploaded.public_id;
  }

  const job = await Job.create(jobData);
  return job;
};

const updateJob = async (
  jobId: string,
  companyId: string,
  payload: UpdateJobPayload,
  projectPictureFile?: Express.Multer.File,
): Promise<IJob> => {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid job ID");
  }
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const existingJob = await Job.findById(jobId);

  if (!existingJob) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job not found");
  }

  if (existingJob.createdBy.toString() !== companyId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to update this job",
    );
  }

  const updateData: Record<string, unknown> = { ...payload };

  if (projectPictureFile) {
    const uploaded = await fileUploader.uploadToCloudinary(
      projectPictureFile,
      "messematch/jobs",
    );
    updateData.projectPicture = uploaded.Location;
    updateData.projectPicturePublicId = uploaded.public_id;

    if (existingJob.projectPicturePublicId) {
      fileUploader
        .deleteFromCloudinary(existingJob.projectPicturePublicId)
        .catch((err) => {
          console.error("Failed to delete old project picture:", err);
        });
    }
  }

  const updatedJob = await Job.findByIdAndUpdate(jobId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updatedJob) {
    throw new ApiError(httpStatus.NOT_FOUND, "Failed to update job");
  }

  return updatedJob;
};

const getJobsByCompany = async (companyId: string) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const jobs = await Job.find({ createdBy: companyId }).sort({ createdAt: -1 });

  // Map to response format with only required fields and formatted period
  return jobs.map((job) => ({
    jobId: job._id,
    projectName: job.projectName,
    location: job.projectLocation,
    personNeeded: job.personNeeded,
    period: formatProjectPeriod(job.projectPeriodFrom, job.projectPeriodTo),
  }));
};

const deleteJob = async (jobId: string, companyId: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid job ID");
  }
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const existingJob = await Job.findById(jobId);

  if (!existingJob) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job not found");
  }

  // Verify ownership
  if (existingJob.createdBy.toString() !== companyId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorized to delete this job",
    );
  }

  // Delete image from Cloudinary if it exists
  if (existingJob.projectPicturePublicId) {
    fileUploader
      .deleteFromCloudinary(existingJob.projectPicturePublicId)
      .catch((err) => {
        console.error("Failed to delete project picture from Cloudinary:", err);
      });
  }

  // Delete job from MongoDB
  await Job.findByIdAndDelete(jobId);
};

export const jobService = {
  createJob,
  updateJob,
  getJobsByCompany,
  deleteJob,
};
