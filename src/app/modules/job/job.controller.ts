import { Request, Response } from "express";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { jobService } from "./job.service";

const createJob = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;
    const projectPictureFile = req.file;

    const result = await jobService.createJob(
      companyId,
      req.body,
      projectPictureFile,
    );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Job created successfully",
      data: result,
    });
  },
);

const updateJob = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const { id: jobId } = req.params;
    const companyId = req.user?.id as string;
    const projectPictureFile = req.file;

    const result = await jobService.updateJob(
      jobId,
      companyId,
      req.body,
      projectPictureFile,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Job updated successfully",
      data: result,
    });
  },
);

const getMyJobs = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const companyId = req.user?.id as string;

    const result = await jobService.getJobsByCompany(companyId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Jobs retrieved successfully",
      data: result,
    });
  },
);

const deleteJob = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const { id: jobId } = req.params;
    const companyId = req.user?.id as string;

    await jobService.deleteJob(jobId, companyId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Job deleted successfully",
      data: null,
    });
  },
);

export const jobController = {
  createJob,
  updateJob,
  getMyJobs,
  deleteJob,
};
