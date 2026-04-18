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
  minimumRate?: number;
  maximumRate?: number;
  createdBy: mongoose.Types.ObjectId;
}

interface RequestForJobPayload {
  jobId: string;
}

interface JobSearchFilterPayload {
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  requiredSkills?: string[];
  minimumRate?: number;
  maximumRate?: number;
  projectPeriodFrom?: Date;
  projectPeriodTo?: Date;
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

interface IncomingRequestsFilter {
  requestStatus?: JobRequestStatus;
}

interface IncomingCompanyRequest {
  requestId: string;
  FitterId: string | null;
  projectPicture: string | null;
  distance: number | null;
  userName: string | null;
  rating: number | null;
  jobCompleted: number | null;
  workLocations: string | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  spokenLanguages: string[] | null;
  skills: string[] | null;
  requestStatus: JobRequestStatus | null;
}

interface IncomingRequestsResponse {
  incomingRequests: IncomingCompanyRequest[];
}

interface ActiveCompanyRequest {
  requestId: string;
  FitterId: string | null;
  projectPicture: string | null;
  projectName: string | null;
  fullName: string | null;
  userName: string | null;
  profilePicture: string | null;
  rating: number | null;
  workLocations: string | null;
  distance: number | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  days: number | null;
  personNeeded: number | null;
  dateRange: string | null;
  requieredSkills: string[] | null;
  requestStatus: JobRequestStatus | null;
}

interface ActiveRequestsResponse {
  activeRequests: ActiveCompanyRequest[];
}

interface UpdateRequestStatusPayload {
  requestStatus: JobRequestStatus.ACCEPTED | JobRequestStatus.REJECTED;
}

interface UpdateRequestStatusResponse {
  requestId: string;
  requestStatus: JobRequestStatus;
  updatedAt: Date;
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

interface JobRequestForCompany {
  _id: mongoose.Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

interface JobPictureLookup {
  _id: mongoose.Types.ObjectId;
  projectPicture?: string;
}

interface JobForActiveRequestLookup {
  _id: mongoose.Types.ObjectId;
  projectPicture?: string;
  projectName?: string;
  projectPeriodFrom?: Date;
  projectPeriodTo?: Date;
  personNeeded?: number;
  requieredSkills?: string[];
}

interface FitterForActiveRequestLookup {
  _id: mongoose.Types.ObjectId;
  fullName?: string;
  userName?: string;
  profilePicture?: string;
  rating?: number;
  workLocations?: string[];
  hourlyRate?: number;
  dailyRate?: number;
}

interface GiveRatingAndReviewPayload {
  rating: number;
  review?: string;
}

interface GiveRatingAndReviewResponse {
  requestId: string;
  rating: number;
  review?: string;
  reviewedAt: Date;
  updatedFitterRating: number;
}

interface RequestedCompanyProfile {
  _id: mongoose.Types.ObjectId;
  companyName?: string;
  profilePicture?: string;
}

interface JobForRequestedLookup {
  _id: mongoose.Types.ObjectId;
  projectPicture?: string;
  projectName: string;
  projectLocation?: string;
  projectPeriodFrom?: Date;
  projectPeriodTo?: Date;
  personNeeded?: number;
  requieredSkills?: string[];
  minimumRate?: number;
  maximumRate?: number;
}

interface JobRequestForFitter {
  _id: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  fitterId: mongoose.Types.ObjectId;
  distance?: number;
  hourlyRate?: number;
  dailyRate?: number;
  requestStatus: JobRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface FitterRequestedActiveJob {
  requestId: string;
  companyId: string;
  companyName: string | null;
  profilePicture: string | null;
  projectPicture: string | null;
  projectName: string | null;
  projectLocation: string | null;
  personNeeded: number | null;
  requieredSkills: string[] | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  days: number | null;
  dateRange: string | null;
  requestStatus: JobRequestStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RequestedJobsResponse {
  requestedJobs: FitterRequestedActiveJob[];
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

const calculateDaysBetween = (
  periodFrom?: Date,
  periodTo?: Date,
): number | undefined => {
  if (!periodFrom || !periodTo) {
    return undefined;
  }

  const fromDate = new Date(periodFrom);
  const toDate = new Date(periodTo);

  const millisecondsInDay = 1000 * 60 * 60 * 24;
  const diffInMilliseconds =
    toDate.setHours(0, 0, 0, 0) - fromDate.setHours(0, 0, 0, 0);

  if (diffInMilliseconds < 0) {
    return undefined;
  }

  return Math.floor(diffInMilliseconds / millisecondsInDay) + 1;
};

const validateActiveCompany = async (
  companyId: string,
): Promise<mongoose.Types.ObjectId> => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  const company = await User.findById(companyObjectId)
    .select("role status")
    .lean<{ role?: UserRole; status?: UserStatus }>();

  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, "Company not found");
  }

  if (company.role !== UserRole.COMPANY) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only companies can access this resource",
    );
  }

  if (company.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.FORBIDDEN, "Company account is not active");
  }

  return companyObjectId;
};

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
    requestStatus: {
      $in: [JobRequestStatus.REQUESTED, JobRequestStatus.ACCEPTED],
    },
  })
    .select("_id")
    .lean();

  if (existingRequest) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "You have already requested this job",
    );
  }

  // Check for recent rejection (cooldown period)
  const lastRejection = await JobRequest.findOne({
    jobId: jobObjectId,
    fitterId: fitterObjectId,
    requestStatus: JobRequestStatus.REJECTED,
  })
    .sort({ rejectedAt: -1 })
    .select("rejectedAt updatedAt")
    .lean();

  if (lastRejection) {
    const rejectionDate = lastRejection.rejectedAt || lastRejection.updatedAt;
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const timeSinceRejection = Date.now() - rejectionDate.getTime();

    if (timeSinceRejection < ONE_MONTH_MS) {
      const retryDate = new Date(rejectionDate.getTime() + ONE_MONTH_MS);
      const day = retryDate.getDate();
      const month = retryDate.toLocaleDateString("en-US", { month: "long" });
      const year = retryDate.getFullYear();
      const formattedDate = `${day} ${month},${year}`;
      throw new ApiError(
        httpStatus.CONFLICT,
        `You rejected by this job. Try requesting again on ${formattedDate}.`,
      );
    }
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

  let createdRequest;

  createdRequest = await JobRequest.create({
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

const getIncomingRequestsForCompany = async (
  companyId: string,
  filters?: IncomingRequestsFilter,
): Promise<IncomingRequestsResponse> => {
  const companyObjectId = await validateActiveCompany(companyId);

  const query: {
    companyId: mongoose.Types.ObjectId;
    requestStatus?: JobRequestStatus;
  } = {
    companyId: companyObjectId,
  };

  if (filters?.requestStatus) {
    query.requestStatus = filters.requestStatus;
  }

  const requests = await JobRequest.find(query)
    .sort({ createdAt: -1 })
    .lean<JobRequestForCompany[]>();

  if (!requests.length) {
    return { incomingRequests: [] };
  }

  const jobIds = [
    ...new Set(requests.map((request) => request.jobId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const jobs = await Job.find({ _id: { $in: jobIds } })
    .select("projectPicture")
    .lean<JobPictureLookup[]>();

  const jobPictureMap = new Map(
    jobs.map((job) => [job._id.toString(), job.projectPicture ?? null]),
  );

  return {
    incomingRequests: requests.map((request) => {
      return {
        requestId: request._id.toString(),
        FitterId: request.fitterId ? request.fitterId.toString() : null,
        projectPicture: jobPictureMap.get(request.jobId.toString()) ?? null,
        distance:
          typeof request.distance === "number" ? request.distance : null,
        userName: request.userName ?? null,
        rating: typeof request.rating === "number" ? request.rating : null,
        jobCompleted:
          typeof request.jobCompleted === "number"
            ? request.jobCompleted
            : null,
        workLocations:
          request.workLocations && request.workLocations.length > 0
            ? request.workLocations[0]
            : null,
        hourlyRate:
          typeof request.hourlyRate === "number" ? request.hourlyRate : null,
        dailyRate:
          typeof request.dailyRate === "number" ? request.dailyRate : null,
        spokenLanguages:
          request.spokenLanguages && request.spokenLanguages.length > 0
            ? request.spokenLanguages
            : null,
        skills:
          request.skills && request.skills.length > 0 ? request.skills : null,
        requestStatus: request.requestStatus ?? null,
      };
    }),
  };
};

const updateRequestStatusForCompany = async (
  companyId: string,
  requestId: string,
  payload: UpdateRequestStatusPayload,
): Promise<UpdateRequestStatusResponse> => {
  const companyObjectId = await validateActiveCompany(companyId);

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid request ID");
  }

  const requestObjectId = new mongoose.Types.ObjectId(requestId);

  if (
    payload.requestStatus !== JobRequestStatus.ACCEPTED &&
    payload.requestStatus !== JobRequestStatus.REJECTED
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Request status must be ACCEPTED or REJECTED",
    );
  }

  const existingRequest = await JobRequest.findOne({
    _id: requestObjectId,
    companyId: companyObjectId,
  });

  if (!existingRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job request not found");
  }

  if (existingRequest.requestStatus !== JobRequestStatus.REQUESTED) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only REQUESTED jobs can be accepted or rejected",
    );
  }

  existingRequest.requestStatus = payload.requestStatus;
  if (payload.requestStatus === JobRequestStatus.REJECTED) {
    existingRequest.rejectedAt = new Date();
  }
  const updatedRequest = await existingRequest.save();

  return {
    requestId: updatedRequest._id.toString(),
    requestStatus: updatedRequest.requestStatus,
    updatedAt: updatedRequest.updatedAt,
  };
};

const getActiveJobRequestsForCompany = async (
  companyId: string,
): Promise<ActiveRequestsResponse> => {
  const companyObjectId = await validateActiveCompany(companyId);

  const requests = await JobRequest.find({
    companyId: companyObjectId,
    requestStatus: JobRequestStatus.ACCEPTED,
  })
    .sort({ createdAt: -1 })
    .lean<JobRequestForCompany[]>();

  if (!requests.length) {
    return { activeRequests: [] };
  }

  const jobIds = [
    ...new Set(requests.map((request) => request.jobId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const fitterIds = [
    ...new Set(requests.map((request) => request.fitterId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const [jobs, fitters] = await Promise.all([
    Job.find({ _id: { $in: jobIds } })
      .select(
        "projectPicture projectPeriodFrom projectPeriodTo personNeeded requieredSkills projectName",
      )
      .lean<JobForActiveRequestLookup[]>(),
    User.find({ _id: { $in: fitterIds } })
      .select(
        "fullName userName profilePicture rating workLocations hourlyRate dailyRate",
      )
      .lean<FitterForActiveRequestLookup[]>(),
  ]);

  const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));
  const fitterMap = new Map(
    fitters.map((fitter) => [fitter._id.toString(), fitter]),
  );

  return {
    activeRequests: requests.map((request) => {
      const job = jobMap.get(request.jobId.toString());
      const fitter = fitterMap.get(request.fitterId.toString());

      const locationValues =
        fitter?.workLocations && fitter.workLocations.length > 0
          ? fitter.workLocations
          : request.workLocations;

      const dateRange = formatProjectPeriod(
        job?.projectPeriodFrom,
        job?.projectPeriodTo,
      );

      const days = calculateDaysBetween(
        job?.projectPeriodFrom,
        job?.projectPeriodTo,
      );

      return {
        requestId: request._id.toString(),
        FitterId: request.fitterId ? request.fitterId.toString() : null,
        projectPicture: job?.projectPicture ?? null,
        projectName: job?.projectName ?? null,
        fullName: fitter?.fullName ?? null,
        userName: fitter?.userName ?? request.userName ?? null,
        profilePicture:
          fitter?.profilePicture ?? request.profilePicture ?? null,
        rating:
          typeof fitter?.rating === "number"
            ? fitter.rating
            : typeof request.rating === "number"
              ? request.rating
              : null,
        workLocations:
          locationValues && locationValues.length > 0
            ? locationValues.join(", ")
            : null,
        distance:
          typeof request.distance === "number" ? request.distance : null,
        hourlyRate:
          typeof fitter?.hourlyRate === "number"
            ? fitter.hourlyRate
            : typeof request.hourlyRate === "number"
              ? request.hourlyRate
              : null,
        dailyRate:
          typeof fitter?.dailyRate === "number"
            ? fitter.dailyRate
            : typeof request.dailyRate === "number"
              ? request.dailyRate
              : null,
        days: typeof days === "number" ? days : null,
        personNeeded:
          typeof job?.personNeeded === "number" ? job.personNeeded : null,
        dateRange: dateRange ?? null,
        requieredSkills:
          job?.requieredSkills && job.requieredSkills.length > 0
            ? job.requieredSkills
            : null,
        requestStatus: request.requestStatus ?? null,
      };
    }),
  };
};

const completeJobRequestForCompany = async (
  companyId: string,
  requestId: string,
): Promise<void> => {
  const companyObjectId = await validateActiveCompany(companyId);
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid request ID");
  }

  const requestObjectId = new mongoose.Types.ObjectId(requestId);

  const existingRequest = await JobRequest.findOne({
    _id: requestObjectId,
    companyId: companyObjectId,
  });
  if (!existingRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, "Request not found");
  }

  if (existingRequest.requestStatus !== JobRequestStatus.ACCEPTED) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only ACCEPTED requests can be completed",
    );
  }

  existingRequest.requestStatus = JobRequestStatus.COMPLETED;
  await existingRequest.save();

  await User.findByIdAndUpdate(
    existingRequest.fitterId,
    { $inc: { jobCompleted: 1 } },
    { new: true },
  );
};

const getCompletedJobRequestsForCompany = async (
  companyId: string,
): Promise<ActiveRequestsResponse> => {
  const companyObjectId = await validateActiveCompany(companyId);

  const requests = await JobRequest.find({
    companyId: companyObjectId,
    requestStatus: JobRequestStatus.COMPLETED,
  })
    .sort({ createdAt: -1 })
    .lean<JobRequestForCompany[]>();

  if (!requests.length) {
    return { activeRequests: [] };
  }

  const jobIds = [
    ...new Set(requests.map((request) => request.jobId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const fitterIds = [
    ...new Set(requests.map((request) => request.fitterId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const [jobs, fitters] = await Promise.all([
    Job.find({ _id: { $in: jobIds } })
      .select(
        "projectPicture projectPeriodFrom projectPeriodTo personNeeded requieredSkills projectName",
      )
      .lean<JobForActiveRequestLookup[]>(),
    User.find({ _id: { $in: fitterIds } })
      .select(
        "fullName userName profilePicture rating workLocations hourlyRate dailyRate",
      )
      .lean<FitterForActiveRequestLookup[]>(),
  ]);

  const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));
  const fitterMap = new Map(
    fitters.map((fitter) => [fitter._id.toString(), fitter]),
  );

  return {
    activeRequests: requests.map((request) => {
      const job = jobMap.get(request.jobId.toString());
      const fitter = fitterMap.get(request.fitterId.toString());

      const locationValues =
        fitter?.workLocations && fitter.workLocations.length > 0
          ? fitter.workLocations
          : request.workLocations;

      const dateRange = formatProjectPeriod(
        job?.projectPeriodFrom,
        job?.projectPeriodTo,
      );

      const days = calculateDaysBetween(
        job?.projectPeriodFrom,
        job?.projectPeriodTo,
      );

      return {
        requestId: request._id.toString(),
        FitterId: request.fitterId ? request.fitterId.toString() : null,
        projectPicture: job?.projectPicture ?? null,
        projectName: job?.projectName ?? null,
        fullName: fitter?.fullName ?? null,
        userName: fitter?.userName ?? request.userName ?? null,
        profilePicture:
          fitter?.profilePicture ?? request.profilePicture ?? null,
        rating:
          typeof fitter?.rating === "number"
            ? fitter.rating
            : typeof request.rating === "number"
              ? request.rating
              : null,
        workLocations:
          locationValues && locationValues.length > 0
            ? locationValues.join(", ")
            : null,
        distance:
          typeof request.distance === "number" ? request.distance : null,
        hourlyRate:
          typeof fitter?.hourlyRate === "number"
            ? fitter.hourlyRate
            : typeof request.hourlyRate === "number"
              ? request.hourlyRate
              : null,
        dailyRate:
          typeof fitter?.dailyRate === "number"
            ? fitter.dailyRate
            : typeof request.dailyRate === "number"
              ? request.dailyRate
              : null,
        days: typeof days === "number" ? days : null,
        personNeeded:
          typeof job?.personNeeded === "number" ? job.personNeeded : null,
        dateRange: dateRange ?? null,
        requieredSkills:
          job?.requieredSkills && job.requieredSkills.length > 0
            ? job.requieredSkills
            : null,
        requestStatus: request.requestStatus ?? null,
      };
    }),
  };
};

const giveRatingAndReviewToFitterForCompletedJob = async (
  companyId: string,
  requestId: string,
  payload: GiveRatingAndReviewPayload,
): Promise<GiveRatingAndReviewResponse> => {
  const companyObjectId = await validateActiveCompany(companyId);

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid request ID");
  }

  const requestObjectId = new mongoose.Types.ObjectId(requestId);

  const jobRequest = await JobRequest.findOne({
    _id: requestObjectId,
    companyId: companyObjectId,
  });

  if (!jobRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, "Job request not found");
  }

  if (jobRequest.requestStatus !== JobRequestStatus.COMPLETED) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only COMPLETED requests can be rated",
    );
  }

  if (
    jobRequest.companyRating !== undefined &&
    jobRequest.companyRating !== null
  ) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "This request has already been rated",
    );
  }

  const reviewedAt = new Date();
  jobRequest.companyRating = payload.rating;
  jobRequest.companyReview = payload.review;
  jobRequest.reviewedAt = reviewedAt;
  const updatedJobRequest = await jobRequest.save();

  // Calculate new average rating for the fitter
  const ratedRequests = await JobRequest.find({
    fitterId: jobRequest.fitterId,
    requestStatus: JobRequestStatus.COMPLETED,
    companyRating: { $exists: true, $ne: null },
  })
    .select("companyRating")
    .lean<{ companyRating: number }[]>();

  let newAverageRating = 0;
  if (ratedRequests.length > 0) {
    const totalRating = ratedRequests.reduce(
      (sum, req) => sum + req.companyRating,
      0,
    );
    newAverageRating = roundToTwo(totalRating / ratedRequests.length);
  }

  // Update fitter's rating
  await User.findByIdAndUpdate(
    jobRequest.fitterId,
    {
      rating: newAverageRating,
    },
    { new: true },
  );

  return {
    requestId: updatedJobRequest._id.toString(),
    rating: updatedJobRequest.companyRating!,
    review: updatedJobRequest.companyReview,
    reviewedAt: updatedJobRequest.reviewedAt!,
    updatedFitterRating: newAverageRating,
  };
};

const validateActiveFitter = async (
  fitterId: string,
): Promise<mongoose.Types.ObjectId> => {
  if (!mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }

  const fitterObjectId = new mongoose.Types.ObjectId(fitterId);

  const fitter = await User.findById(fitterObjectId)
    .select("role status")
    .lean<{ role?: UserRole; status?: UserStatus }>();

  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  if (fitter.role !== UserRole.FITTER) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only fitters can access this resource",
    );
  }

  if (fitter.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.FORBIDDEN, "Fitter account is not active");
  }

  return fitterObjectId;
};

interface ResolvedFilters {
  latitude: number;
  longitude: number;
  distanceKm: number;
  requiredSkills: string[];
  minimumRate?: number;
  maximumRate?: number;
  projectPeriodFrom: Date;
  projectPeriodTo?: Date;
}

const resolveFitterFilters = async (
  fitterId: mongoose.Types.ObjectId,
  filters: JobSearchFilterPayload,
): Promise<ResolvedFilters> => {
  const fitter = await User.findById(fitterId)
    .select("skills lattitude longitude hourlyRate")
    .lean<FitterProfile>();

  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  const latitude = filters.latitude ?? fitter.lattitude;
  const longitude = filters.longitude ?? fitter.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Location data required. Please provide latitude/longitude or set profile location",
    );
  }

  return {
    latitude,
    longitude,
    distanceKm: filters.distanceKm ?? 500,
    requiredSkills: filters.requiredSkills ?? fitter.skills ?? [],
    minimumRate: filters.minimumRate ?? fitter.hourlyRate,
    maximumRate: filters.maximumRate,
    projectPeriodFrom: filters.projectPeriodFrom ?? new Date(),
    projectPeriodTo: filters.projectPeriodTo,
  };
};

const searchAndFilterJobs = async (
  userId: string,
  filters: JobSearchFilterPayload,
): Promise<MatchingResponse> => {
  const fitterId = await validateActiveFitter(userId);
  const resolved = await resolveFitterFilters(fitterId, filters);

  const jobs = await Job.find({ jobStatus: JobStatus.ACTIVE })
    .select(
      "projectPicture projectName projectLocation projectPeriodFrom projectPeriodTo personNeeded requieredSkills minimumRate maximumRate createdBy",
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

  const resolvedSkills = normalizeTextArray(resolved.requiredSkills);

  const matchingJobs = jobs
    .reduce<FitterMatchingJob[]>((acc, job) => {
      const company = companyMap.get(job.createdBy.toString());

      if (!company) {
        return acc;
      }

      const hasCoordinates =
        typeof resolved.latitude === "number" &&
        typeof resolved.longitude === "number" &&
        typeof company.lattitude === "number" &&
        typeof company.longitude === "number";

      const distanceKm = hasCoordinates
        ? haversineDistance(
            resolved.latitude,
            resolved.longitude,
            company.lattitude as number,
            company.longitude as number,
          )
        : undefined;

      // Distance filter
      if (typeof distanceKm === "number" && distanceKm > resolved.distanceKm) {
        return acc;
      }

      // Skills filter
      const jobSkills = normalizeTextArray(job.requieredSkills);
      const skillsScore = calculateOverlapScore(jobSkills, resolvedSkills);

      if (skillsScore <= MATCHING_CONFIG.MINIMUM_SCORE_PERCENT) {
        return acc;
      }

      // Rate filter - ensure job rate range meets fitter's rate requirements
      const jobMinRate = job.minimumRate ?? 0;
      const jobMaxRate = job.maximumRate ?? Number.MAX_VALUE;

      // If fitter specified a minimum rate they want to work for
      if (
        resolved.minimumRate !== undefined &&
        jobMaxRate < resolved.minimumRate
      ) {
        return acc; // job's max rate is below what fitter wants
      }

      // If fitter specified a maximum rate they're willing to work for
      if (
        resolved.maximumRate !== undefined &&
        jobMinRate > resolved.maximumRate
      ) {
        return acc; // job's min rate is above what fitter is willing to do
      }

      // Date filter
      const jobFromDate = job.projectPeriodFrom
        ? new Date(job.projectPeriodFrom)
        : undefined;
      const jobToDate = job.projectPeriodTo
        ? new Date(job.projectPeriodTo)
        : undefined;
      const resolvedFromDate = new Date(resolved.projectPeriodFrom);
      resolvedFromDate.setHours(0, 0, 0, 0);

      if (jobFromDate) {
        const jobFromTime = new Date(jobFromDate);
        jobFromTime.setHours(0, 0, 0, 0);

        if (jobFromTime > resolvedFromDate) {
          return acc;
        }
      }

      if (resolved.projectPeriodTo && jobToDate) {
        const resolvedToDate = new Date(resolved.projectPeriodTo);
        resolvedToDate.setHours(0, 0, 0, 0);

        const jobToTime = new Date(jobToDate);
        jobToTime.setHours(0, 0, 0, 0);

        if (jobToTime > resolvedToDate) {
          return acc;
        }
      }

      // Calculate match score
      const distanceScore = calculateDistanceScore(distanceKm);
      const finalScore =
        skillsScore * MATCHING_CONFIG.WEIGHTS.skills +
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

const getRequestedJobsForFitter = async (
  fitterId: string,
  filters?: { requestStatus?: JobRequestStatus },
): Promise<RequestedJobsResponse> => {
  const fitterObjectId = await validateActiveFitter(fitterId);

  const query: Record<string, unknown> = {
    fitterId: fitterObjectId,
  };

  if (filters?.requestStatus) {
    query.requestStatus = filters.requestStatus;
  }

  const requests = await JobRequest.find(query)
    .sort({ createdAt: -1 })
    .lean<JobRequestForFitter[]>();

  if (!requests.length) {
    return { requestedJobs: [] };
  }

  const jobIds = [
    ...new Set(requests.map((request) => request.jobId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const companyIds = [
    ...new Set(requests.map((request) => request.companyId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const [jobs, companies] = await Promise.all([
    Job.find({ _id: { $in: jobIds } })
      .select(
        "projectPicture projectName projectLocation projectPeriodFrom projectPeriodTo personNeeded requieredSkills minimumRate maximumRate",
      )
      .lean<JobForRequestedLookup[]>(),
    User.find({ _id: { $in: companyIds } })
      .select("companyName profilePicture")
      .lean<RequestedCompanyProfile[]>(),
  ]);

  const jobMap = new Map(jobs.map((job) => [job._id.toString(), job]));
  const companyMap = new Map(
    companies.map((company) => [company._id.toString(), company]),
  );

  return {
    requestedJobs: requests.map((request) => {
      const job = jobMap.get(request.jobId.toString());
      const company = companyMap.get(request.companyId.toString());

      const dateRange = formatProjectPeriod(
        job?.projectPeriodFrom,
        job?.projectPeriodTo,
      );

      const days = calculateDaysBetween(
        job?.projectPeriodFrom,
        job?.projectPeriodTo,
      );

      return {
        requestId: request._id.toString(),
        companyId: request.companyId.toString(),
        companyName: company?.companyName ?? null,
        projectName: job?.projectName ?? null,
        projectPicture: job?.projectPicture ?? null,
        profilePicture: company?.profilePicture ?? null,
        projectLocation: job?.projectLocation ?? null,
        days: typeof days === "number" ? days : null,
        hourlyRate:
          typeof request.hourlyRate === "number" ? request.hourlyRate : null,
        dailyRate:
          typeof request.dailyRate === "number" ? request.dailyRate : null,
        personNeeded:
          typeof job?.personNeeded === "number" ? job.personNeeded : null,
        dateRange: dateRange ?? null,
        requieredSkills:
          job?.requieredSkills && job.requieredSkills.length > 0
            ? job.requieredSkills
            : null,
        requestStatus: request.requestStatus ?? null,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      };
    }),
  };
};

export const matchingService = {
  matchingForFitter,
  requestForJob,
  getIncomingRequestsForCompany,
  getActiveJobRequestsForCompany,
  updateRequestStatusForCompany,
  completeJobRequestForCompany,
  getCompletedJobRequestsForCompany,
  giveRatingAndReviewToFitterForCompletedJob,
  searchAndFilterJobs,
  getRequestedJobsForFitter,
};
