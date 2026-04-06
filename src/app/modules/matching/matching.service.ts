import mongoose from "mongoose";
import httpStatus from "http-status";
import { User, UserRole, UserStatus } from "../../models";
import { Job, JobStatus } from "../job/job.model";
import { JobRequest, JobRequestStatus } from "../job/jobRequest.model";
import ApiError from "../../../errors/ApiErrors";
import haversineDistance from "../../../utils/HeversineDistance";
import { MATCHING_CONFIG } from "./matching.constants";

interface FitterMatchingJob {
  jobId: string;
  projectPicture?: string;
  projectName: string;
  companyName: string;
  projectLocation?: string;
  projectPeriod?: string;
  personNeeded?: number;
  requieredSkills: string[];
  distance?: number;
  matchScore: number;
}

interface MatchingResponse {
  MatchingJobs: FitterMatchingJob[];
}

interface FitterProfile {
  role?: UserRole;
  status?: UserStatus;
  profilePicture?: string;
  userName?: string;
  rating?: number;
  jobCompleted?: number;
  workLocations?: string[];
  hourlyRate?: number;
  dailyRate?: number;
  skills?: string[];
  spokenLanguages?: string[];
  lattitude?: number;
  longitude?: number;
}

interface CompanyProfile {
  _id: mongoose.Types.ObjectId;
  companyName?: string;
  lattitude?: number;
  longitude?: number;
}

interface JobForMatching {
  _id: mongoose.Types.ObjectId;
  projectPicture?: string;
  projectName: string;
  projectLocation?: string;
  projectPeriodFrom?: Date;
  projectPeriodTo?: Date;
  personNeeded?: number;
  requieredSkills?: string[];
  requiredLanguages?: string[];
  createdBy: mongoose.Types.ObjectId;
}

interface RequestForJobPayload {
  jobId: string;
}

interface RequestForJobResponse {
  requestId: string;
  jobId: string;
  companyId: string;
  fitterId: string;
  profilePicture?: string;
  distance?: number;
  userName?: string;
  rating?: number;
  jobCompleted?: number;
  workLocations: string[];
  hourlyRate?: number;
  dailyRate?: number;
  spokenLanguages: string[];
  skills: string[];
  requestStatus: JobRequestStatus;
}

interface JobForRequest {
  _id: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  jobStatus?: JobStatus;
}

interface CompanyForRequest {
  _id: mongoose.Types.ObjectId;
  role?: UserRole;
  status?: UserStatus;
  lattitude?: number;
  longitude?: number;
}

const normalizeTextArray = (values?: string[]): string[] => {
  if (!values || !values.length) {
    return [];
  }

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
};

const calculateOverlapScore = (
  source: string[],
  targetRequirements: string[],
): number => {
  if (!targetRequirements.length) {
    return 100;
  }

  const sourceSet = new Set(source);
  const matchedCount = targetRequirements.filter((item) =>
    sourceSet.has(item),
  ).length;
  return (matchedCount / targetRequirements.length) * 100;
};

const calculateDistanceScore = (distanceKm?: number): number => {
  if (typeof distanceKm !== "number") {
    return 0;
  }

  const normalized =
    ((MATCHING_CONFIG.MAX_DISTANCE_KM - distanceKm) /
      MATCHING_CONFIG.MAX_DISTANCE_KM) *
    100;

  return Math.max(0, Math.min(100, normalized));
};

const formatProjectPeriod = (
  periodFrom?: Date,
  periodTo?: Date,
): string | undefined => {
  if (!periodFrom || !periodTo) {
    return undefined;
  }

  const fromDate = new Date(periodFrom);
  const toDate = new Date(periodTo);

  const fromDay = fromDate.getDate();
  const fromMonth = fromDate.toLocaleString("en-US", { month: "long" });
  const fromYear = fromDate.getFullYear();

  const toDay = toDate.getDate();
  const toMonth = toDate.toLocaleString("en-US", { month: "long" });
  const toYear = toDate.getFullYear();

  if (fromMonth === toMonth && fromYear === toYear) {
    return `${fromDay}-${toDay} ${toMonth} ${toYear}`;
  }

  if (fromYear === toYear) {
    return `${fromDay} ${fromMonth} - ${toDay} ${toMonth} ${toYear}`;
  }

  return `${fromDay} ${fromMonth} ${fromYear} - ${toDay} ${toMonth} ${toYear}`;
};

const roundToTwo = (value: number): number => Number(value.toFixed(2));

const matchingForFitter = async (userId: string): Promise<MatchingResponse> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const fitter = await User.findById(userId)
    .select("role status skills spokenLanguages lattitude longitude")
    .lean<FitterProfile>();

  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  if (fitter.role !== UserRole.FITTER) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only fitters can access matching jobs",
    );
  }

  if (fitter.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.FORBIDDEN, "Fitter account is not active");
  }

  const jobs = await Job.find({ jobStatus: JobStatus.ACTIVE })
    .select(
      "projectPicture projectName projectLocation projectPeriodFrom projectPeriodTo personNeeded requieredSkills requiredLanguages createdBy",
    )
    .lean<JobForMatching[]>();

  if (!jobs.length) {
    return { MatchingJobs: [] };
  }

  const companyIds = [
    ...new Set(jobs.map((job) => job.createdBy.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const companies = await User.find({
    _id: { $in: companyIds },
    role: UserRole.COMPANY,
    status: UserStatus.ACTIVE,
  })
    .select("companyName lattitude longitude")
    .lean<CompanyProfile[]>();

  const companyMap = new Map(
    companies.map((company) => [company._id.toString(), company]),
  );

  const fitterSkills = normalizeTextArray(fitter.skills);
  const fitterLanguages = normalizeTextArray(fitter.spokenLanguages);

  const matchingJobs = jobs
    .reduce<FitterMatchingJob[]>((acc, job) => {
      const company = companyMap.get(job.createdBy.toString());

      if (!company) {
        return acc;
      }

      const requiredSkills = normalizeTextArray(job.requieredSkills);
      const requiredLanguages = normalizeTextArray(job.requiredLanguages);

      const skillsScore = calculateOverlapScore(fitterSkills, requiredSkills);
      const languageScore = calculateOverlapScore(
        fitterLanguages,
        requiredLanguages,
      );

      const hasCoordinates =
        typeof fitter.lattitude === "number" &&
        typeof fitter.longitude === "number" &&
        typeof company.lattitude === "number" &&
        typeof company.longitude === "number";

      const distanceKm = hasCoordinates
        ? haversineDistance(
            fitter.lattitude as number,
            fitter.longitude as number,
            company.lattitude as number,
            company.longitude as number,
          )
        : undefined;

      const distanceScore = calculateDistanceScore(distanceKm);

      const finalScore =
        skillsScore * MATCHING_CONFIG.WEIGHTS.skills +
        languageScore * MATCHING_CONFIG.WEIGHTS.languages +
        distanceScore * MATCHING_CONFIG.WEIGHTS.distance;

      const matchScore = roundToTwo(finalScore);

      if (matchScore <= MATCHING_CONFIG.MINIMUM_SCORE_PERCENT) {
        return acc;
      }

      acc.push({
        jobId: job._id.toString(),
        projectPicture: job.projectPicture,
        projectName: job.projectName,
        companyName: company.companyName ?? "Unknown Company",
        projectLocation: job.projectLocation,
        projectPeriod: formatProjectPeriod(
          job.projectPeriodFrom,
          job.projectPeriodTo,
        ),
        personNeeded: job.personNeeded,
        requieredSkills: job.requieredSkills ?? [],
        distance:
          typeof distanceKm === "number" ? roundToTwo(distanceKm) : undefined,
        matchScore,
      });

      return acc;
    }, [])
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }

      if (typeof a.distance === "number" && typeof b.distance === "number") {
        return a.distance - b.distance;
      }

      if (typeof a.distance === "number") {
        return -1;
      }

      if (typeof b.distance === "number") {
        return 1;
      }

      return 0;
    });

  return {
    MatchingJobs: matchingJobs,
  };
};

const requestForJob = async (
  fitterId: string,
  payload: RequestForJobPayload,
): Promise<RequestForJobResponse> => {
  if (!mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }

  if (!payload?.jobId || !mongoose.Types.ObjectId.isValid(payload.jobId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid job ID");
  }

  const fitterObjectId = new mongoose.Types.ObjectId(fitterId);
  const jobObjectId = new mongoose.Types.ObjectId(payload.jobId);

  const fitter = await User.findById(fitterObjectId)
    .select(
      "role status profilePicture userName rating jobCompleted workLocations hourlyRate dailyRate spokenLanguages skills lattitude longitude",
    )
    .lean<FitterProfile>();

  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  if (fitter.role !== UserRole.FITTER) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only fitters can request jobs");
  }

  if (fitter.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.FORBIDDEN, "Fitter account is not active");
  }

  const job = await Job.findById(jobObjectId)
    .select("createdBy jobStatus")
    .lean<JobForRequest>();

  if (!job) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job not found");
  }

  if (job.jobStatus !== JobStatus.ACTIVE) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Job is not active");
  }

  if (job.createdBy.toString() === fitterId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You cannot request your own job",
    );
  }

  const company = await User.findById(job.createdBy)
    .select("role status lattitude longitude")
    .lean<CompanyForRequest>();

  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job posting company not found");
  }

  if (
    company.role !== UserRole.COMPANY ||
    company.status !== UserStatus.ACTIVE
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Job posting company is not available",
    );
  }

  const existingRequest = await JobRequest.findOne({
    jobId: jobObjectId,
    fitterId: fitterObjectId,
  })
    .select("_id")
    .lean();

  if (existingRequest) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "You have already requested this job",
    );
  }

  const hasCoordinates =
    typeof fitter.lattitude === "number" &&
    typeof fitter.longitude === "number" &&
    typeof company.lattitude === "number" &&
    typeof company.longitude === "number";

  const distance = hasCoordinates
    ? roundToTwo(
        haversineDistance(
          fitter.lattitude as number,
          fitter.longitude as number,
          company.lattitude as number,
          company.longitude as number,
        ),
      )
    : undefined;

  const createdRequest = await JobRequest.create({
    jobId: jobObjectId,
    companyId: company._id,
    fitterId: fitterObjectId,
    profilePicture: fitter.profilePicture,
    distance,
    userName: fitter.userName,
    rating: fitter.rating,
    jobCompleted: fitter.jobCompleted,
    workLocations: fitter.workLocations ?? [],
    hourlyRate: fitter.hourlyRate,
    dailyRate: fitter.dailyRate,
    spokenLanguages: fitter.spokenLanguages ?? [],
    skills: fitter.skills ?? [],
    requestStatus: JobRequestStatus.REQUESTED,
  });

  return {
    requestId: createdRequest._id.toString(),
    jobId: createdRequest.jobId.toString(),
    companyId: createdRequest.companyId.toString(),
    fitterId: createdRequest.fitterId.toString(),
    profilePicture: createdRequest.profilePicture,
    distance: createdRequest.distance,
    userName: createdRequest.userName,
    rating: createdRequest.rating,
    jobCompleted: createdRequest.jobCompleted,
    workLocations: createdRequest.workLocations ?? [],
    hourlyRate: createdRequest.hourlyRate,
    dailyRate: createdRequest.dailyRate,
    spokenLanguages: createdRequest.spokenLanguages ?? [],
    skills: createdRequest.skills ?? [],
    requestStatus: createdRequest.requestStatus,
  };
};

export const matchingService = {
  matchingForFitter,
  requestForJob,
};
