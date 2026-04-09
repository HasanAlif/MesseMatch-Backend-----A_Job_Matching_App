import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { profileService } from "./profile.service";

const getCompanyProfile = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;

    const result = await profileService.getCompanyProfile(companyId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Company profile retrieved successfully",
      data: result,
    });
  },
);

const updateCompanyProfile = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const profilePictureFile = req.file;

    const result = await profileService.updateCompanyProfile(
      companyId,
      req.body,
      profilePictureFile,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Profile updated successfully",
      data: result,
    });
  },
);

const getCompanyInfo = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;

    const result = await profileService.getCompanyInfo(companyId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Company info retrieved successfully",
      data: result,
    });
  },
);

const updateCompanyInfo = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;

    const result = await profileService.updateCompanyInfo(companyId, req.body);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Company info updated successfully",
      data: result,
    });
  },
);

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const result = await profileService.changePassword(
    req.user.id,
    oldPassword,
    newPassword,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully!",
    data: result,
  });
});

export const profileController = {
  updateCompanyProfile,
  getCompanyProfile,
  getCompanyInfo,
  updateCompanyInfo,
  changePassword,
};
