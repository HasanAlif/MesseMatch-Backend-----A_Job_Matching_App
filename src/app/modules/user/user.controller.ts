import { Request, Response } from "express";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { userService } from "./user.service";

// Register new user - sends OTP
const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createUserIntoDb(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email. Please verify to complete registration.",
    data: result,
  });
});

// Verify registration OTP
const verifyRegistrationOtp = catchAsync(
  async (req: Request, res: Response) => {
    const result = await userService.verifyRegistrationOtp(req.body);

    // Set token in cookie after successful verification
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Prepare response data
    const responseData: any = {
      user: result.user,
      token: result.token,
    };

    // Include device error if present (non-blocking)
    if (result.deviceRegistrationError) {
      responseData.deviceError = result.deviceRegistrationError;
    }

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: result.deviceRegistrationError
        ? "Email verified but device registration failed"
        : "Email verified and registration completed successfully!",
      data: responseData,
    });
  },
);

// Resend registration OTP
const resendRegistrationOtp = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await userService.resendRegistrationOtp(email);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OTP resent to your email",
      data: result,
    });
  },
);

// Complete profile as Fitter
const completeProfileAsFitter = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const profilePictureFile = req.file;

    const result = await userService.completeProfileAsFitter(
      userId,
      req.body,
      profilePictureFile,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Profile completed successfully",
      data: result,
    });
  },
);

// Complete profile as Company
const completeProfileAsCompany = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;

    const result = await userService.completeProfileAsCompany(
      userId,
      req.body,
      {
        businessRegDocument: files?.businessRegDocument?.[0],
        taxIdDocument: files?.taxIdDocument?.[0],
      },
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Company profile completed successfully",
      data: result,
    });
  },
);

export const userController = {
  createUser,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  completeProfileAsFitter,
  completeProfileAsCompany,
};
