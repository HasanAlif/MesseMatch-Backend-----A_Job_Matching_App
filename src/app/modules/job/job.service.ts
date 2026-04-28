import mongoose from "mongoose";
import { Job, IJob, JobStatus } from "./job.model";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { fileUploader } from "../../../helpars/fileUploader";
import { User, Plan } from "../../models";

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

interface CompanyJobDetail {
  jobId: string;
  projectName: string;
  jobStatus: JobStatus;
  location: string | null;
  period: string | undefined;
  applicants: number;
  personNeeded: number | null;
}

interface CompanyJobsWithApplicantsResponse {
  totalApplicant: number;
  activeJob: number;
  data: CompanyJobDetail[];
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

const validateJobCreateLimit = async (companyId: string): Promise<void> => {
  const company = await User.findById(companyId)
    .select("plan")
    .lean<{ plan?: Plan }>();

  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, "Company not found");
  }

  const plan = company.plan;

  // Determine job limit based on plan
  let limit = 5; // Default limit for BASIC and LAUNCH_PREMIUM
  if (plan === Plan.PREMIUM) {
    limit = 12;
  }

  const activeJobCount = await Job.countDocuments({
    createdBy: new mongoose.Types.ObjectId(companyId),
    jobStatus: JobStatus.ACTIVE,
  });

  if (activeJobCount >= limit) {
    const planName = plan || "BASIC";
    throw new ApiError(
      httpStatus.CONFLICT,
      `You have reached the maximum job creation limit of ${limit} jobs for your ${planName} plan. Please upgrade your plan or delete existing jobs to create new ones.`,
    );
  }
};

const createJob = async (
  companyId: string,
  payload: CreateJobPayload,
  projectPictureFile?: Express.Multer.File,
): Promise<IJob> => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  await validateJobCreateLimit(companyId);

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

const getJobsByCompany = async (
  companyId: string,
): Promise<CompanyJobsWithApplicantsResponse> => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  // Aggregation pipeline to get jobs with applicant counts
  const jobsWithApplicants = await Job.aggregate([
    {
      $match: { createdBy: companyObjectId },
    },
    {
      $lookup: {
        from: "jobrequests",
        let: { jobId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$jobId", "$$jobId"] },
              requestStatus: "REQUESTED",
            },
          },
          {
            $count: "count",
          },
        ],
        as: "applicantData",
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $project: {
        _id: 1,
        projectName: 1,
        projectLocation: 1,
        projectPeriodFrom: 1,
        projectPeriodTo: 1,
        personNeeded: 1,
        jobStatus: 1,
        applicantCount: {
          $cond: [
            { $gt: [{ $size: "$applicantData" }, 0] },
            { $arrayElemAt: ["$applicantData.count", 0] },
            0,
          ],
        },
      },
    },
  ]);

  // Calculate totals
  let totalApplicant = 0;
  let activeJob = 0;

  const formattedJobs: CompanyJobDetail[] = jobsWithApplicants.map((job) => {
    totalApplicant += job.applicantCount;
    if (job.jobStatus === JobStatus.ACTIVE) {
      activeJob += 1;
    }

    return {
      jobId: job._id.toString(),
      projectName: job.projectName,
      jobStatus: job.jobStatus,
      location: job.projectLocation ?? null,
      period: formatProjectPeriod(job.projectPeriodFrom, job.projectPeriodTo),
      applicants: job.applicantCount,
      personNeeded: job.personNeeded ?? null,
    };
  });

  return {
    totalApplicant,
    activeJob,
    data: formattedJobs,
  };
};

const changeJobStatus = async (
  jobId: string,
  companyId: string,
  newStatus: JobStatus,
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
      "You are not authorized to change the status of this job",
    );
  }

  existingJob.jobStatus = newStatus;
  await existingJob.save();

  return existingJob;
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
  changeJobStatus,
};
