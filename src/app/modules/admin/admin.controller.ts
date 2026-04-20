import httpStatus from "http-status";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { adminService } from "./admin.service";
import { ContentType } from "./appContent.model";
import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";

const getContentTypeName = (type: string): string => {
  const typeNames: Record<string, string> = {
    [ContentType.ABOUT_US]: "About Us",
    [ContentType.PRIVACY_POLICY]: "Privacy Policy",
    [ContentType.TERMS_AND_CONDITIONS]: "Terms and Conditions",
  };
  return typeNames[type] || type;
};

const createOrUpdateContent = catchAsync(async (req, res) => {
  const { type } = req.params;
  const { content } = req.body;
  const result = await adminService.createOrUpdateContent(
    type as ContentType,
    content,
  );

  const contentTypeName = getContentTypeName(type);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${contentTypeName} updated successfully`,
    data: result,
  });
});

const getContentByType = catchAsync(async (req, res) => {
  const { type } = req.params;
  const result = await adminService.getContentByType(type as ContentType);

  const contentTypeName = getContentTypeName(type);
  const message = result._id
    ? `${contentTypeName} retrieved successfully`
    : `${contentTypeName} not yet created`;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message,
    data: result,
  });
});

const getMonthlyUserGrowth = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const year =
      (req.query.year as unknown as number) || new Date().getFullYear();
    const result = await adminService.getMonthlyUserGrowth(year);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Monthly user growth retrieved successfully",
      data: result,
    });
  },
);

const getRecentUsers = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const result = await adminService.getRecentUsers();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Recent users retrieved successfully",
      data: result,
    });
  },
);

const getAllUsers = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const status = (req.query.status as string) || undefined;
    const page = (req.query.page as unknown as number) || 1;
    const limit = (req.query.limit as unknown as number) || 10;

    const result = await adminService.getAllUsers(status, page, limit);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Users retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  },
);

const searchUsers = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const { searchQuery } = req.query;
    const page = (req.query.page as unknown as number) || 1;
    const limit = (req.query.limit as unknown as number) || 10;

    const result = await adminService.searchUsers(
      searchQuery as string,
      page,
      limit,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Users search results retrieved successfully",
      meta: result.meta,
      data: result.data,
    });
  },
);

export const adminController = {
  createOrUpdateContent,
  getContentByType,
  getMonthlyUserGrowth,
  getRecentUsers,
  getAllUsers,
  searchUsers,
};
