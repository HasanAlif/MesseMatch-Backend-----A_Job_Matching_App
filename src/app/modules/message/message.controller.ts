import httpStatus from "http-status";
import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { messageService } from "./message.service";
import { MESSAGE_SUCCESS } from "./message.constants";

const getUsersForSidebar = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.getUsersForSidebar(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: MESSAGE_SUCCESS.USERS_RETRIEVED,
    data: result,
  });
});

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const result = await messageService.getMessages(req.user.id, req.params.id, {
    page,
    limit,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: MESSAGE_SUCCESS.RETRIEVED,
    data: {
      receiver: result.receiver,
      messages: result.messages,
    },
    meta: result.meta,
  });
});

const getUnreadMessageCount = catchAsync(
  async (req: Request, res: Response) => {
    const result = await messageService.getUnreadMessageCount(req.user.id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: MESSAGE_SUCCESS.UNREAD_COUNT,
      data: result,
    });
  },
);

export const messageController = {
  getUsersForSidebar,
  getMessages,
  getUnreadMessageCount,
};
