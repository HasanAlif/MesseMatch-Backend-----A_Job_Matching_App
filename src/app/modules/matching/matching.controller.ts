import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { matchingService } from "./matching.service";
import { JobRequestStatus } from "../job/jobRequest.model";

const getMatchingJobsForFitter = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const result = await matchingService.matchingForFitter(userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Matching jobs retrieved successfully",
      data: result,
    });
  },
);

const getMatchingFittersForCompany = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const result = await matchingService.matchingForCompany(companyId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Matching fitters retrieved successfully",
      data: result,
    });
  },
);

const requestForJob = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const fitterId = req.user?.id as string;
    const result = await matchingService.requestForJob(fitterId, req.body);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Job request sent successfully",
      data: result,
    });
  },
);

const getIncomingRequestsForCompany = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const requestStatus = req.query.requestStatus as
      | JobRequestStatus
      | undefined;

    const result = await matchingService.getIncomingRequestsForCompany(
      companyId,
      { requestStatus },
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Incoming requests retrieved successfully",
      data: result,
    });
  },
);

const getActiveJobRequestsForCompany = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const result =
      await matchingService.getActiveJobRequestsForCompany(companyId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Active requests retrieved successfully",
      data: result,
    });
  },
);

const updateRequestStatusForCompany = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const { requestId } = req.params;

    const result = await matchingService.updateRequestStatusForCompany(
      companyId,
      requestId,
      req.body,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Request status updated successfully",
      data: result,
    });
  },
);

const completeJobRequestForCompany = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const { requestId } = req.params;

    const result = await matchingService.completeJobRequestForCompany(
      companyId,
      requestId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Job request marked as completed successfully",
      data: result,
    });
  },
);

const getCompletedJobRequestsForCompany = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;

    const result =
      await matchingService.getCompletedJobRequestsForCompany(companyId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Completed job requests retrieved successfully",
      data: result,
    });
  },
);

const giveRatingAndReviewToFitter = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const { requestId } = req.params;

    const result =
      await matchingService.giveRatingAndReviewToFitterForCompletedJob(
        companyId,
        requestId,
        req.body,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Rating and review submitted successfully",
      data: result,
    });
  },
);

const searchAndFilterJobs = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const filters = req.query as any;

    const parsedFilters = {
      ...filters,
      latitude: filters.latitude ? Number(filters.latitude) : undefined,
      longitude: filters.longitude ? Number(filters.longitude) : undefined,
      distanceKm: filters.distanceKm ? Number(filters.distanceKm) : undefined,
      minimumRate: filters.minimumRate
        ? Number(filters.minimumRate)
        : undefined,
      maximumRate: filters.maximumRate
        ? Number(filters.maximumRate)
        : undefined,
      projectPeriodFrom: filters.projectPeriodFrom
        ? new Date(filters.projectPeriodFrom)
        : undefined,
      projectPeriodTo: filters.projectPeriodTo
        ? new Date(filters.projectPeriodTo)
        : undefined,
      requiredSkills: Array.isArray(filters.requiredSkills)
        ? filters.requiredSkills
        : undefined,
    };

    const result = await matchingService.searchAndFilterJobs(
      userId,
      parsedFilters,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Jobs retrieved successfully",
      data: result,
    });
  },
);

const getRequestedJobsForFitter = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const requestStatus = req.query.requestStatus as
      | JobRequestStatus
      | undefined;

    const result = await matchingService.getRequestedJobsForFitter(userId, {
      requestStatus,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Requested jobs retrieved successfully",
      data: result,
    });
  },
);

export const matchingController = {
  getMatchingJobsForFitter,
  getMatchingFittersForCompany,
  requestForJob,
  getIncomingRequestsForCompany,
  getActiveJobRequestsForCompany,
  updateRequestStatusForCompany,
  completeJobRequestForCompany,
  getCompletedJobRequestsForCompany,
  giveRatingAndReviewToFitter,
  searchAndFilterJobs,
  getRequestedJobsForFitter,
};
