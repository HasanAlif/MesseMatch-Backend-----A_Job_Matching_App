import httpStatus from "http-status";
import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { messageService } from "./message.service";
import { MESSAGE_SUCCESS, MESSAGE_ERRORS } from "./message.constants";
import ApiError from "../../../errors/ApiErrors";

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
    data: result.messages,
    meta: result.meta,
  });
});

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const { id: receiverId } = req.params;
  const senderId = req.user.id;

  if (senderId === receiverId) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.SELF_MESSAGE);
  }

  const text = req.body.text;
  const files = req.files as Express.Multer.File[] | undefined;

  const result = await messageService.sendMessage(senderId, receiverId, {
    text,
    files,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: MESSAGE_SUCCESS.SENT,
    data: result,
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

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  await messageService.markMessagesAsRead(req.user.id, req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: MESSAGE_SUCCESS.MARKED_READ,
    data: null,
  });
});

export const messageController = {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  getUnreadMessageCount,
  markAsRead,
};
