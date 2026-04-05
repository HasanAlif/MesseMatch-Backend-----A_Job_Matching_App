import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { matchingService } from "./matching.service";

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

export const matchingController = {
  getMatchingJobsForFitter,
};
