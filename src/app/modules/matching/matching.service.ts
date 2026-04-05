import mongoose from "mongoose";
import httpStatus from "http-status";
import { User, UserRole, UserStatus } from "../../models";
import { Job, JobStatus } from "../job/job.model";
import ApiError from "../../../errors/ApiErrors";
import haversineDistance from "../../../utils/HeversineDistance";
import { MATCHING_CONFIG } from "./matching.constants";

interface FitterMatchingJob {
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

const normalizeTextArray = (values?: string[]): string[] => {
  if (!values || !values.length) {
    return [];
  }

  return values
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

export const matchingService = {
  matchingForFitter,
};
