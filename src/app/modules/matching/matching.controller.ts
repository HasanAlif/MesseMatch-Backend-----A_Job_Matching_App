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

export const matchingController = {
  getMatchingJobsForFitter,
  requestForJob,
  getIncomingRequestsForCompany,
  getActiveJobRequestsForCompany,
  updateRequestStatusForCompany,
  completeJobRequestForCompany,
};
