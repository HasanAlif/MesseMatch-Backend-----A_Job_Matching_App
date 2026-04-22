import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { subscriptionService } from "./subscription.service";

const incrementSwipeCount = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const fitterId = req.user?.id as string;

    const result = await subscriptionService.swipeCountForFitter(fitterId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Swipe count incremented successfully",
      data: result,
    });
  },
);

export const subscriptionController = {
  incrementSwipeCount,
};
